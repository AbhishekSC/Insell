import mongoose from "mongoose";
import Deal, { DEAL_STAGES } from "../models/Deal.model.js";
import Offer from "../models/Offer.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import * as NotificationService from "../services/NotificationService.js";
import { NotificationChannel } from "../services/NotificationService.js";

const CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE];

function modeForPost(post) {
  const lt = String(post?.listingType || "").toLowerCase();
  const pt = String(post?.postType || "").toUpperCase();
  return lt === "rent" || lt === "lease" || pt === "PROPERTY_RENT" ? "RENT" : "BUY";
}

function stagesFor(deal) {
  return DEAL_STAGES[deal.mode] || DEAL_STAGES.BUY;
}

function nextStageKey(deal) {
  const keys = stagesFor(deal).map((s) => s.key);
  const done = new Set(deal.completedStages || []);
  return keys.find((k) => !done.has(k)) || null;
}

// Create the Deal for an accepted offer if one doesn't exist yet. Idempotent
// (unique index on `offer`), so it's safe to call from the accept path *and*
// lazily on first read (covers offers accepted before this feature shipped).
export async function ensureDealForOffer(offerId, { session } = {}) {
  const existing = await Deal.findOne({ offer: offerId }).session(session || null);
  if (existing) return existing;

  const offer = await Offer.findById(offerId)
    .populate("post", "listingType postType title author")
    .session(session || null)
    .lean();
  if (!offer || offer.status !== "accepted" || !offer.post) return null;

  const mode = modeForPost(offer.post);
  try {
    const [created] = await Deal.create(
      [
        {
          post: offer.post._id,
          offer: offer._id,
          buyer: offer.buyer,
          owner: offer.owner,
          agreedPrice: offer.currentPrice,
          mode,
          status: "ACTIVE",
          currentStage: nextStageKey({ mode, completedStages: ["agreed"] }),
          completedStages: ["agreed"],
          history: [{ action: "create", stage: "agreed", by: offer.owner, message: "Offer accepted" }],
        },
      ],
      session ? { session } : {}
    );
    return created;
  } catch (err) {
    if (err?.code === 11000) return Deal.findOne({ offer: offerId }).session(session || null);
    throw err;
  }
}

async function notifyCounterparty(deal, actorId, actorName, type, title, message) {
  const recipientId = String(deal.buyer) === String(actorId) ? deal.owner : deal.buyer;
  return NotificationService.send({
    recipientId,
    actorId,
    type,
    title,
    message,
    pushBody: actorName ? `${actorName}: ${title}` : title,
    data: { propertyPost: deal.post, offer: deal.offer, deal: deal._id, url: `/property/${deal.post}` },
    channels: CHANNELS,
  }).catch((e) => logger.error("deal notify failed (non-fatal):", e));
}

function serialize(deal) {
  const stages = stagesFor(deal);
  const done = new Set(deal.completedStages || []);
  const label = (k) => stages.find((s) => s.key === k)?.label || k;
  return {
    ...deal.toObject ? deal.toObject() : deal,
    stages: stages.map((s) => ({ ...s, done: done.has(s.key) })),
    nextStage: deal.status === "ACTIVE" ? nextStageKey(deal) : null,
    pendingStageLabel: deal.pendingStage ? label(deal.pendingStage.key) : null,
  };
}

// GET /deals/mine
export async function getMyDeals(req, res) {
  try {
    const userId = req.user._id;
    const deals = await Deal.find({ $or: [{ buyer: userId }, { owner: userId }] })
      .sort({ updatedAt: -1 })
      .populate("post", "title mediaUrls city locality price listingType")
      .populate("buyer", "fullName profilePic")
      .populate("owner", "fullName profilePic")
      .lean();
    return sendSuccessResponse(res, 200, "Deals retrieved", {
      deals: deals.map((d) => ({
        ...d,
        stages: (DEAL_STAGES[d.mode] || DEAL_STAGES.BUY).map((s) => ({ ...s, done: (d.completedStages || []).includes(s.key) })),
      })),
    });
  } catch (error) {
    logger.error("Error in getMyDeals:", error);
    return sendErrorResponse(res, 500, "Failed to load deals");
  }
}

// GET /deals/post/:postId — the deal for this post, if the viewer is a party.
export async function getDealForPost(req, res) {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    let deal = await Deal.findOne({ post: postId, $or: [{ buyer: userId }, { owner: userId }] });
    if (!deal) {
      // Lazily create it from an accepted offer this user is party to — but
      // only if the accept is recent. Old/test offers that predate this
      // feature shouldn't spawn a pile of stuck "documents"-stage deals.
      const recentCutoff = new Date(Date.now() - 30 * 86400000);
      const accepted = await Offer.findOne({
        post: postId,
        status: "accepted",
        updatedAt: { $gte: recentCutoff },
        $or: [{ buyer: userId }, { owner: userId }],
      }).select("_id");
      if (accepted) deal = await ensureDealForOffer(accepted._id);
    }
    if (!deal) return sendSuccessResponse(res, 200, "No deal", { deal: null });

    await deal.populate("buyer", "fullName profilePic");
    await deal.populate("owner", "fullName profilePic");
    return sendSuccessResponse(res, 200, "Deal retrieved", { deal: serialize(deal) });
  } catch (error) {
    logger.error("Error in getDealForPost:", error);
    return sendErrorResponse(res, 500, "Failed to load deal");
  }
}

function isDuplicateRequestIdError(err) {
  return err?.code === 11000 && /history\.requestId/.test(err?.message || "");
}
async function reloadSerialized(dealId) {
  const d = await Deal.findById(dealId).populate("buyer", "fullName profilePic").populate("owner", "fullName profilePic");
  return d ? serialize(d) : null;
}
async function reopenListing(deal, actorId) {
  await PropertyPost.updateOne({ _id: deal.post, offerStatus: "ACCEPTED" }, { $set: { offerStatus: "OPEN" } });
  await Offer.updateOne({ _id: deal.offer, status: "accepted" }, { $set: { status: "declined", lastActionBy: actorId } }).catch(() => {});
}

// PATCH /deals/:id
// body: { action, message?, reason?, amount?, requestId? }
// action ∈ propose | confirm | dispute | revert | note | attach-only-via-endpoint
//        | cancel_request | cancel_confirm | cancel | report
// Every mutation is a single conditional findOneAndUpdate (atomic) and
// idempotent under a repeated requestId, mirroring the Offer flow.
export async function updateDeal(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const action = String(req.body?.action || "").trim();
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (requestId) {
      const replay = await Deal.findOne({ _id: id, "history.requestId": requestId });
      if (replay) return sendSuccessResponse(res, 200, "Already processed", { deal: await reloadSerialized(id) });
    }

    const deal = await Deal.findById(id).lean();
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    const isParty = [String(deal.buyer), String(deal.owner)].includes(String(userId));
    if (!isParty) return sendErrorResponse(res, 403, "You're not a party to this deal");
    const terminalOk = ["note", "report"].includes(action);
    if (deal.status !== "ACTIVE" && !terminalOk) {
      return sendErrorResponse(res, 409, `This deal is ${deal.status.toLowerCase()}`);
    }

    const actorName = req.user.fullName;
    const modeStages = DEAL_STAGES[deal.mode] || DEAL_STAGES.BUY;
    const stageKeys = modeStages.map((s) => s.key);
    const stageLabel = (k) => modeStages.find((s) => s.key === k)?.label || k;
    const hist = (extra) => ({ by: userId, ...extra, ...(requestId ? { requestId } : {}) });
    const done = new Set(deal.completedStages || []);
    const nextKeyFrom = (set) => stageKeys.find((k) => !set.has(k)) || null;

    // Can't move stages while a cancellation is on the table — resolve that first.
    if (deal.pendingCancel && ["propose", "confirm", "dispute", "revert"].includes(action)) {
      return sendErrorResponse(res, 409, "There's a cancellation request open — accept or withdraw it first");
    }

    try {
      // ---- note ---------------------------------------------------------
      if (action === "note") {
        if (!message) return sendErrorResponse(res, 400, "Add a note");
        await Deal.updateOne({ _id: id }, { $push: { history: hist({ action: "note", stage: deal.currentStage, message }) } });
        return sendSuccessResponse(res, 200, "Note added", { deal: await reloadSerialized(id) });
      }

      // ---- report ------------------------------------------------------
      if (action === "report") {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 1000);
        if (!reason) return sendErrorResponse(res, 400, "Say what's wrong");
        await Deal.updateOne({ _id: id }, {
          $push: {
            reports: { by: userId, reason },
            history: hist({ action: "report", stage: deal.currentStage, message: reason }),
          },
        });
        logger.warn(`[DEAL REPORT] deal ${id} by ${userId}: ${reason}`);
        return sendSuccessResponse(res, 200, "Reported — the team will take a look", { deal: await reloadSerialized(id) });
      }

      // ---- propose ----------------------------------------------------
      if (action === "propose") {
        const target = nextKeyFrom(done);
        if (!target) return sendErrorResponse(res, 409, "All stages are already complete");
        const amount = target === "payment" ? Math.max(0, Math.round(Number(req.body?.amount) || 0)) : null;

        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", pendingStage: null },
          {
            $set: { pendingStage: { key: target, proposedBy: userId, proposedAt: new Date(), message, amount } },
            $push: { history: hist({ action: "propose", stage: target, message }) },
          },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Something's already waiting to be confirmed — refresh");

        await notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${actorName} says "${stageLabel(target)}" is done`,
          amount ? `They recorded ${amount.toLocaleString("en-IN")} — confirm it, or flag if it isn't right.` : `Confirm it on your deal, or flag if it isn't.`);
        return sendSuccessResponse(res, 200, "Marked — waiting for confirmation", { deal: await reloadSerialized(id) });
      }

      // ---- confirm / dispute ----------------------------------------
      if (action === "confirm" || action === "dispute") {
        if (!deal.pendingStage) return sendErrorResponse(res, 409, "Nothing is pending confirmation");
        if (String(deal.pendingStage.proposedBy) === String(userId)) {
          return sendErrorResponse(res, 409, "The other party has to act on this — you proposed it");
        }
        const target = deal.pendingStage.key;
        const pendingAmount = deal.pendingStage.amount || null;

        if (action === "dispute") {
          const disputeKey = `disputeCounts.${target}`;
          const nextCount = (Number(deal.disputeCounts?.[target]) || 0) + 1;
          const updated = await Deal.findOneAndUpdate(
            { _id: id, status: "ACTIVE", "pendingStage.key": target },
            {
              $set: { pendingStage: null, ...(nextCount >= 2 ? { disputed: true } : {}) },
              $inc: { [disputeKey]: 1 },
              $push: { history: hist({ action: "dispute", stage: target, message: message || "Flagged as not done" }) },
            },
            { new: true }
          );
          if (!updated) return sendErrorResponse(res, 409, "That's no longer pending — refresh");
          await notifyCounterparty(updated, userId, actorName, "deal_updated",
            `${actorName} flagged "${stageLabel(target)}"`,
            message ? `"${message}"` : `They say it isn't done yet.`);
          return sendSuccessResponse(res, 200, "Flagged", { deal: await reloadSerialized(id) });
        }

        // confirm
        const afterSet = new Set([...done, target]);
        const isFinal = stageKeys[stageKeys.length - 1] === target;
        const set = {
          pendingStage: null,
          currentStage: nextKeyFrom(afterSet) || target,
          disputed: false, // moving forward = the disagreement is resolved
          ...(target === "payment" && pendingAmount ? { paymentAmount: pendingAmount, paymentConfirmedBy: userId } : {}),
          ...(isFinal ? { status: "COMPLETED", completedAt: new Date() } : {}),
        };
        const push = { history: { $each: [hist({ action: "confirm", stage: target, message })] } };
        if (isFinal) push.history.$each.push({ by: userId, action: "complete", stage: target });

        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingStage.key": target, "pendingStage.proposedBy": { $ne: userId } },
          { $set: set, $addToSet: { completedStages: target }, $push: push },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "That's no longer pending — refresh");

        if (isFinal) {
          await PropertyPost.updateOne({ _id: updated.post }, { $set: { status: "ARCHIVED" } }).catch(() => {});
          await notifyCounterparty(updated, userId, actorName, "deal_completed",
            `Deal completed 🎉`, `${actorName} confirmed the final step. Leave each other a review!`);
        } else {
          await notifyCounterparty(updated, userId, actorName, "deal_updated",
            `"${stageLabel(target)}" confirmed`, `${actorName} confirmed it — on to ${stageLabel(updated.currentStage)}.`);
        }
        return sendSuccessResponse(res, 200, "Confirmed", { deal: await reloadSerialized(id) });
      }

      // ---- revert --------------------------------------------------
      if (action === "revert") {
        if (deal.pendingStage) {
          if (String(deal.pendingStage.proposedBy) !== String(userId)) {
            return sendErrorResponse(res, 409, "Only the party who proposed this can withdraw it — the other can flag it");
          }
          const updated = await Deal.findOneAndUpdate(
            { _id: id, status: "ACTIVE", "pendingStage.proposedBy": userId },
            { $set: { pendingStage: null }, $push: { history: hist({ action: "revert", stage: deal.pendingStage.key, message }) } },
            { new: true }
          );
          if (!updated) return sendErrorResponse(res, 409, "Nothing to withdraw — refresh");
          return sendSuccessResponse(res, 200, "Withdrawn", { deal: await reloadSerialized(id) });
        }
        const lastDone = [...(deal.completedStages || [])].reverse().find((k) => k !== "agreed");
        if (!lastDone) return sendErrorResponse(res, 409, "Nothing to undo");
        if (lastDone === "payment") return sendErrorResponse(res, 409, "Can't undo a confirmed payment — cancel the deal instead if it's off");
        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", completedStages: lastDone },
          { $pull: { completedStages: lastDone }, $set: { currentStage: lastDone }, $push: { history: hist({ action: "revert", stage: lastDone, message }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already changed — refresh");
        await notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${stageLabel(lastDone)} reopened`, `${actorName} moved the deal back to "${stageLabel(lastDone)}".`);
        return sendSuccessResponse(res, 200, "Stage reverted", { deal: await reloadSerialized(id) });
      }

      // ---- cancel ------------------------------------------------
      // Before payment: unilateral. After payment: a request the other must accept.
      const paid = done.has("payment");

      if (action === "cancel" && !paid) {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 500);
        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE" },
          { $set: { status: "CANCELLED", cancelledReason: reason, cancelledBy: userId }, $push: { history: hist({ action: "cancel", stage: deal.currentStage, message: reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Deal already closed — refresh");
        await reopenListing(updated, userId);
        await notifyCounterparty(updated, userId, actorName, "deal_cancelled",
          `Deal cancelled`, `${actorName} cancelled the deal${reason ? ` — "${reason}"` : ""}. The listing is open again.`);
        return sendSuccessResponse(res, 200, "Deal cancelled", { deal: await reloadSerialized(id) });
      }

      if ((action === "cancel" || action === "cancel_request") && paid) {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 500);
        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", pendingCancel: null },
          { $set: { pendingCancel: { requestedBy: userId, reason, requestedAt: new Date() } }, $push: { history: hist({ action: "cancel_request", stage: deal.currentStage, message: reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, deal.pendingCancel ? "A cancellation request is already open" : "Refresh and try again");
        await notifyCounterparty(updated, userId, actorName, "deal_cancelled",
          `${actorName} wants to cancel the deal`,
          `Payment has been made — cancelling now needs your agreement.${reason ? ` Reason: "${reason}"` : ""}`);
        return sendSuccessResponse(res, 200, "Cancellation requested — waiting for the other party", { deal: await reloadSerialized(id) });
      }

      // The requester retracts their own pending cancellation.
      if (action === "cancel_withdraw") {
        if (!deal.pendingCancel) return sendErrorResponse(res, 409, "No cancellation request open");
        if (String(deal.pendingCancel.requestedBy) !== String(userId)) {
          return sendErrorResponse(res, 409, "Only the party who asked to cancel can withdraw it");
        }
        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingCancel.requestedBy": userId },
          { $set: { pendingCancel: null }, $push: { history: hist({ action: "revert", stage: deal.currentStage, message: "Cancellation withdrawn" }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${actorName} withdrew the cancellation`, `The deal is back on track.`);
        return sendSuccessResponse(res, 200, "Cancellation withdrawn", { deal: await reloadSerialized(id) });
      }

      if (action === "cancel_confirm") {
        if (!deal.pendingCancel) return sendErrorResponse(res, 409, "No cancellation request to accept");
        if (String(deal.pendingCancel.requestedBy) === String(userId)) {
          return sendErrorResponse(res, 409, "The other party has to accept this");
        }
        const updated = await Deal.findOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingCancel.requestedBy": { $ne: userId } },
          { $set: { status: "CANCELLED", cancelledReason: deal.pendingCancel.reason, cancelledBy: deal.pendingCancel.requestedBy, pendingCancel: null }, $push: { history: hist({ action: "cancel_confirm", stage: deal.currentStage, message: deal.pendingCancel.reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await reopenListing(updated, userId);
        await notifyCounterparty(updated, updated.pendingCancel?.requestedBy || userId, actorName, "deal_cancelled",
          `Deal cancelled`, `Both parties agreed to cancel. The listing is open again.`);
        return sendSuccessResponse(res, 200, "Deal cancelled", { deal: await reloadSerialized(id) });
      }

      return sendErrorResponse(res, 400, "Invalid action");
    } catch (err) {
      if (isDuplicateRequestIdError(err)) {
        const winner = await Deal.findOne({ _id: id, "history.requestId": requestId });
        if (winner) return sendSuccessResponse(res, 200, "Already processed", { deal: await reloadSerialized(id) });
      }
      throw err;
    }
  } catch (error) {
    logger.error("Error in updateDeal:", error);
    return sendErrorResponse(res, 500, "Failed to update deal");
  }
}

// GET /admin/deal-stats  (admin only)
export async function getDealStats(_req, res) {
  try {
    const [byStatus, byStage, cancelReasons, medianDays, attention] = await Promise.all([
      Deal.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Deal.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$currentStage", n: { $sum: 1 } } }]),
      Deal.aggregate([
        { $match: { status: "CANCELLED", cancelledReason: { $ne: "" } } },
        { $group: { _id: "$cancelledReason", n: { $sum: 1 } } },
        { $sort: { n: -1 } }, { $limit: 10 },
      ]),
      Deal.aggregate([
        { $match: { status: "COMPLETED", completedAt: { $ne: null } } },
        { $project: { days: { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 86400000] } } },
        { $group: { _id: null, avg: { $avg: "$days" } } },
      ]),
      // Deals that need a human look: reported (open) or disputed.
      Deal.find({
        $or: [{ "reports.resolved": false }, { disputed: true, status: "ACTIVE" }],
      })
        .sort({ updatedAt: -1 })
        .limit(50)
        .populate("post", "title")
        .populate("buyer", "fullName")
        .populate("owner", "fullName")
        .select("post buyer owner status currentStage mode disputed reports agreedPrice updatedAt")
        .lean(),
    ]);
    const completed = byStatus.find((s) => s._id === "COMPLETED")?.n || 0;
    const cancelled = byStatus.find((s) => s._id === "CANCELLED")?.n || 0;

    return sendSuccessResponse(res, 200, "Deal stats", {
      stats: {
        byStatus,
        activeByStage: byStage,
        topCancelReasons: cancelReasons,
        avgDaysToClose: medianDays[0]?.avg ? Math.round(medianDays[0].avg * 10) / 10 : null,
        completionRate: completed + cancelled > 0 ? Math.round((completed / (completed + cancelled)) * 100) : null,
        attention: attention.map((d) => ({
          _id: d._id,
          postId: d.post?._id,
          title: d.post?.title || "—",
          buyer: { id: d.buyer?._id || null, name: d.buyer?.fullName || "—" },
          owner: { id: d.owner?._id || null, name: d.owner?.fullName || "—" },
          status: d.status,
          currentStage: d.currentStage,
          disputed: d.disputed,
          openReports: (d.reports || []).filter((r) => !r.resolved).map((r) => ({ by: r.by, reason: r.reason, at: r.at })),
          agreedPrice: d.agreedPrice,
          updatedAt: d.updatedAt,
        })),
      },
    });
  } catch (error) {
    logger.error("Error in getDealStats:", error);
    return sendErrorResponse(res, 500, "Failed to load stats");
  }
}

// GET /admin/deals?status=&page=&limit=  (admin) — browse actual deals.
export async function adminListDeals(req, res) {
  try {
    const status = ["ACTIVE", "COMPLETED", "CANCELLED"].includes(String(req.query.status)) ? String(req.query.status) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(5, Number(req.query.limit) || 20));
    const filter = status ? { status } : {};

    const [deals, total] = await Promise.all([
      Deal.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("post", "title")
        .populate("buyer", "fullName")
        .populate("owner", "fullName")
        .select("post buyer owner status currentStage mode agreedPrice disputed reports completedStages createdAt updatedAt")
        .lean(),
      Deal.countDocuments(filter),
    ]);

    return sendSuccessResponse(res, 200, "Deals", {
      deals: deals.map((d) => ({
        _id: d._id,
        postId: d.post?._id,
        title: d.post?.title || "—",
        buyer: { id: d.buyer?._id || null, name: d.buyer?.fullName || "—" },
        owner: { id: d.owner?._id || null, name: d.owner?.fullName || "—" },
        status: d.status,
        currentStage: d.currentStage,
        mode: d.mode,
        agreedPrice: d.agreedPrice,
        disputed: d.disputed,
        openReports: (d.reports || []).filter((r) => !r.resolved).length,
        progress: `${(d.completedStages || []).length}`,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error in adminListDeals:", error);
    return sendErrorResponse(res, 500, "Failed to list deals");
  }
}

// POST /admin/deals/:id/resolve-report  (admin) — clears open reports + the
// disputed flag, records who resolved it.
export async function adminResolveDealReports(req, res) {
  try {
    const adminId = req.user._id;
    const updated = await Deal.findByIdAndUpdate(
      req.params.id,
      {
        $set: { "reports.$[r].resolved": true, disputed: false },
        $push: { history: { action: "note", by: adminId, message: "Reports reviewed and closed by the team" } },
      },
      { new: true, arrayFilters: [{ "r.resolved": false }] }
    );
    if (!updated) return sendErrorResponse(res, 404, "Deal not found");
    return sendSuccessResponse(res, 200, "Resolved", { deal: serialize(updated) });
  } catch (error) {
    logger.error("Error in adminResolveDealReports:", error);
    return sendErrorResponse(res, 500, "Failed to resolve");
  }
}

// POST /admin/deals/:id/force-cancel  (admin)  body: { reason }
export async function adminForceCancelDeal(req, res) {
  try {
    const adminId = req.user._id;
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (!reason) return sendErrorResponse(res, 400, "A reason is required");

    const updated = await Deal.findOneAndUpdate(
      { _id: req.params.id, status: "ACTIVE" },
      {
        $set: { status: "CANCELLED", cancelledReason: `[Admin] ${reason}`, cancelledBy: adminId, pendingStage: null, pendingCancel: null, disputed: false },
        $push: { history: { action: "cancel", by: adminId, message: `Cancelled by the team: ${reason}` } },
      },
      { new: true }
    );
    if (!updated) return sendErrorResponse(res, 409, "Deal isn't active");
    await reopenListing(updated, adminId);

    for (const recipientId of [updated.buyer, updated.owner]) {
      await NotificationService.send({
        recipientId, actorId: adminId, type: "deal_cancelled",
        title: "Your deal was cancelled by the team",
        message: `The deal for this property was cancelled by NearMySpace: ${reason}`,
        data: { propertyPost: updated.post, deal: updated._id, url: `/property/${updated.post}` },
        channels: CHANNELS,
      }).catch(() => {});
    }
    return sendSuccessResponse(res, 200, "Deal cancelled", { deal: serialize(updated) });
  } catch (error) {
    logger.error("Error in adminForceCancelDeal:", error);
    return sendErrorResponse(res, 500, "Failed to cancel");
  }
}

// POST /deals/:id/attachments  (multipart: file, + optional stage, name)
export async function addDealAttachment(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const deal = await Deal.findById(id);
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    if (![String(deal.buyer), String(deal.owner)].includes(String(userId))) {
      return sendErrorResponse(res, 403, "You're not a party to this deal");
    }
    if (!req.file?.path) return sendErrorResponse(res, 400, "No file uploaded");

    const name = String(req.body?.name || req.file.originalname || "Document").trim().slice(0, 120);
    const stage = String(req.body?.stage || deal.currentStage || "").trim();

    // Guard against a double-submit / retry (multer already consumed the
    // stream, so real idempotency isn't possible — a same-name same-stage
    // upload by the same user within 30s is treated as the retry it almost
    // certainly is).
    const cutoff = Date.now() - 30_000;
    const dupe = (deal.attachments || []).some(
      (a) => a.name === name && a.stage === stage && String(a.uploadedBy) === String(userId) && new Date(a.uploadedAt).getTime() > cutoff
    );
    if (dupe) return sendSuccessResponse(res, 200, "Document attached", { deal: serialize(deal) });

    const updated = await Deal.findByIdAndUpdate(
      id,
      {
        $push: {
          attachments: { url: req.file.path, name, stage, uploadedBy: userId },
          history: { action: "attach", stage, by: userId, message: name },
        },
      },
      { new: true }
    );

    await notifyCounterparty(updated, userId, req.user.fullName, "deal_updated",
      `${req.user.fullName} attached a document`,
      `"${name}" was added to your deal.`);
    return sendSuccessResponse(res, 200, "Document attached", { deal: await reloadSerialized(id) });
  } catch (error) {
    logger.error("Error in addDealAttachment:", error);
    return sendErrorResponse(res, 500, "Failed to attach document");
  }
}

// DELETE /deals/:id/attachments/:attId  (only the uploader can remove)
export async function removeDealAttachment(req, res) {
  try {
    const userId = req.user._id;
    const { id, attId } = req.params;
    const deal = await Deal.findById(id).select("attachments").lean();
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    const att = (deal.attachments || []).find((a) => String(a._id) === String(attId));
    if (!att) return sendErrorResponse(res, 404, "Attachment not found");
    if (String(att.uploadedBy) !== String(userId)) {
      return sendErrorResponse(res, 403, "Only the person who uploaded it can remove it");
    }

    await Deal.updateOne({ _id: id }, { $pull: { attachments: { _id: attId } } });

    // Free the Cloudinary asset — best effort.
    try {
      const { deleteFromCloudinary, extractPublicIdFromUrl } = await import("../config/cloudinary.js");
      const publicId = extractPublicIdFromUrl(att.url);
      if (publicId) await deleteFromCloudinary(publicId);
    } catch (e) {
      logger.warn("deal attachment cloudinary cleanup failed (non-fatal):", e?.message);
    }

    return sendSuccessResponse(res, 200, "Removed", { deal: await reloadSerialized(id) });
  } catch (error) {
    logger.error("Error in removeDealAttachment:", error);
    return sendErrorResponse(res, 500, "Failed to remove attachment");
  }
}

// POST /deals/cron/nudge-stalled   (header: x-cron-secret)
// Reminds both parties about ACTIVE deals that haven't moved in a while.
const STALLED_AFTER_DAYS = 7;
const NUDGE_COOLDOWN_DAYS = 7;
export async function nudgeStalledDeals(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }
    const staleBefore = new Date(Date.now() - STALLED_AFTER_DAYS * 86400000);
    const nudgeBefore = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86400000);

    const stalled = await Deal.find({
      status: "ACTIVE",
      updatedAt: { $lt: staleBefore },
      $or: [{ lastNudgedAt: null }, { lastNudgedAt: { $lt: nudgeBefore } }],
    })
      .populate("post", "title")
      .limit(200)
      .lean();

    let nudged = 0;
    for (const deal of stalled) {
      const stage = stagesFor(deal).find((s) => s.key === deal.currentStage)?.label || deal.currentStage;
      const days = Math.round((Date.now() - new Date(deal.updatedAt).getTime()) / 86400000);
      const title = deal.pendingStage ? `A step is waiting on you` : `Your deal hasn't moved in ${days} days`;
      const msg = `"${deal.post?.title || "your deal"}" has been at "${stage}" for ${days} days — everything on track?`;
      for (const recipientId of [deal.buyer, deal.owner]) {
        await NotificationService.send({
          recipientId, actorId: null, type: "deal_updated", title, message: msg,
          data: { propertyPost: deal.post?._id || deal.post, deal: deal._id, url: `/property/${deal.post?._id || deal.post}` },
          channels: CHANNELS,
        }).catch(() => {});
      }
      // updateOne with timestamps:false — nudging is a reminder, not deal
      // activity, so it shouldn't reset the "stalled" clock.
      await Deal.updateOne({ _id: deal._id }, { $set: { lastNudgedAt: new Date() } }, { timestamps: false });
      nudged += 1;
    }
    return sendSuccessResponse(res, 200, "Stalled deals swept", { checked: stalled.length, nudged });
  } catch (error) {
    logger.error("Error in nudgeStalledDeals:", error);
    return sendErrorResponse(res, 500, "Sweep failed");
  }
}
