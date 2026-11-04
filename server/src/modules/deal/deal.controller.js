import crypto from "crypto";
import mongoose from "mongoose";
import { DEAL_STAGES } from "../../models/Deal.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import * as repo from "./deal.repository.js";
import * as service from "./deal.service.js";
import { serializeDeal, toMyDealDTO, toAdminDealDTO, toAttentionDealDTO, toDealSummaryDTO, toPublicVerificationDTO } from "./deal.dto.js";
import {
  STALLED_AFTER_DAYS, NUDGE_COOLDOWN_DAYS, RECENT_OFFER_CUTOFF_DAYS,
  DUPE_ATTACH_COOLDOWN_MS, DISPUTE_DEADLINE_HOURS, GEO_FENCE_RADIUS_METERS,
  VALID_ATTACHMENT_CATEGORIES, VALID_AMENDMENT_TYPES, VALID_ADMIN_STATUSES,
  ADMIN_LIST_MAX_LIMIT, ADMIN_LIST_MIN_LIMIT, ADMIN_LIST_DEFAULT_LIMIT,
} from "./deal.constants.js";

export { ensureDealForOffer } from "./deal.service.js";

export async function getMyDeals(req, res) {
  try {
    const deals = await repo.findMyDeals(req.user._id) || [];
    return sendSuccessResponse(res, 200, "Deals retrieved", { deals: deals.map(toMyDealDTO) });
  } catch (error) {
    logger.error("Error in getMyDeals:", error);
    return sendErrorResponse(res, 500, "Failed to load deals");
  }
}

export async function getDealForPost(req, res) {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    let deal = await repo.findDealForPostByStatus(postId, userId, "ACTIVE");
    if (!deal) deal = await repo.findDealForPostByStatus(postId, userId, "COMPLETED");
    if (!deal) deal = await repo.findDealForPostByStatus(postId, userId, null);

    if (!deal) {
      const recentCutoff = new Date(Date.now() - RECENT_OFFER_CUTOFF_DAYS * 86400000);
      const accepted = await repo.findRecentAcceptedOffer(postId, userId, recentCutoff);
      if (accepted) deal = await service.ensureDealForOffer(accepted._id);
    }
    if (!deal) return sendSuccessResponse(res, 200, "No deal", { deal: null });

    await deal.populate("buyer", "fullName profilePic");
    await deal.populate("owner", "fullName profilePic");
    return sendSuccessResponse(res, 200, "Deal retrieved", { deal: serializeDeal(deal) });
  } catch (error) {
    logger.error("Error in getDealForPost:", error);
    return sendErrorResponse(res, 500, "Failed to load deal");
  }
}

export async function updateDeal(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const action = String(req.body?.action || "").trim();
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (requestId) {
      const replay = await repo.findDealByRequestId(id, requestId);
      if (replay) return sendSuccessResponse(res, 200, "Already processed", { deal: await service.reloadSerialized(id) });
    }

    const deal = await repo.findDealById(id);
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

    if (deal.pendingCancel && ["propose", "confirm", "dispute", "revert"].includes(action)) {
      return sendErrorResponse(res, 409, "There's a cancellation request open — accept or withdraw it first");
    }

    try {
      if (action === "note") {
        if (!message) return sendErrorResponse(res, 400, "Add a note");
        await repo.updateDealPush(id, { $push: { history: hist({ action: "note", stage: deal.currentStage, message }) } });
        return sendSuccessResponse(res, 200, "Note added", { deal: await service.reloadSerialized(id) });
      }

      if (action === "report") {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 1000);
        if (!reason) return sendErrorResponse(res, 400, "Say what's wrong");
        await repo.updateDealPush(id, {
          $push: {
            reports: { by: userId, reason },
            history: hist({ action: "report", stage: deal.currentStage, message: reason }),
          },
        });
        logger.warn(`[DEAL REPORT] deal ${id} by ${userId}: ${reason}`);
        return sendSuccessResponse(res, 200, "Reported — the team will take a look", { deal: await service.reloadSerialized(id) });
      }

      if (action === "propose") {
        const target = nextKeyFrom(done);
        if (!target) return sendErrorResponse(res, 409, "All stages are already complete");
        const amount = target === "payment" ? Math.max(0, Math.round(Number(req.body?.amount) || 0)) : null;
        const paymentMode = target === "payment" ? String(req.body?.paymentMode || "NEFT").toUpperCase() : "NEFT";
        const transactionRef = target === "payment" ? String(req.body?.transactionRef || "").trim() : "";
        const bankName = target === "payment" ? String(req.body?.bankName || "").trim() : "";
        const receiptUrl = target === "payment" ? (req.body?.receiptUrl ? String(req.body.receiptUrl).trim() : null) : null;

        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", pendingStage: null },
          {
            $set: {
              pendingStage: { key: target, proposedBy: userId, proposedAt: new Date(), message, amount, paymentMode, transactionRef, bankName, receiptUrl },
            },
            $push: { history: hist({ action: "propose", stage: target, message }) },
          },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Something's already waiting to be confirmed — refresh");

        await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${actorName} says "${stageLabel(target)}" is done`,
          amount ? `They recorded ${amount.toLocaleString("en-IN")}${transactionRef ? ` via ${paymentMode} (Ref: ${transactionRef})` : ""} — confirm it, or flag if it isn't right.` : `Confirm it on your deal, or flag if it isn't.`);
        return sendSuccessResponse(res, 200, "Marked — waiting for confirmation", { deal: await service.reloadSerialized(id) });
      }

      if (action === "confirm" || action === "dispute") {
        if (!deal.pendingStage) return sendErrorResponse(res, 409, "Nothing is pending confirmation");
        if (String(deal.pendingStage.proposedBy) === String(userId)) {
          return sendErrorResponse(res, 409, "The other party has to act on this — you proposed it");
        }
        const target = deal.pendingStage.key;
        const pendingAmount = deal.pendingStage.amount || null;

        if (action === "dispute") {
          const disputeKey = `disputeCounts.${target}`;
          const disputeDeadline = new Date(Date.now() + DISPUTE_DEADLINE_HOURS * 3600 * 1000);
          const updated = await repo.dealFindOneAndUpdate(
            { _id: id, status: "ACTIVE", "pendingStage.key": target },
            {
              $set: { pendingStage: null, disputed: true, disputeDeadline },
              $inc: { [disputeKey]: 1 },
              $push: { history: hist({ action: "dispute", stage: target, message: message || "Flagged as not done (48h resolution window initiated)" }) },
            },
            { new: true }
          );
          if (!updated) return sendErrorResponse(res, 409, "That's no longer pending — refresh");
          await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
            `${actorName} flagged "${stageLabel(target)}"`,
            message ? `"${message}" (48-hour resolution period active)` : `They say it isn't done yet. 48-hour resolution period active.`);
          return sendSuccessResponse(res, 200, "Flagged", { deal: await service.reloadSerialized(id) });
        }

        const afterSet = new Set([...done, target]);
        const isFinal = stageKeys[stageKeys.length - 1] === target;
        const set = {
          pendingStage: null,
          currentStage: nextKeyFrom(afterSet) || target,
          disputed: false,
          ...(target === "payment" && pendingAmount ? {
            paymentAmount: pendingAmount,
            paymentConfirmedBy: userId,
            paymentDetails: {
              amount: pendingAmount,
              paymentMode: deal.pendingStage?.paymentMode || "NEFT",
              transactionRef: deal.pendingStage?.transactionRef || "",
              bankName: deal.pendingStage?.bankName || "",
              receiptUrl: deal.pendingStage?.receiptUrl || null,
              paidAt: deal.pendingStage?.proposedAt || new Date(),
            },
          } : {}),
          ...(isFinal ? { status: "COMPLETED", completedAt: new Date() } : {}),
        };
        const push = { history: { $each: [hist({ action: "confirm", stage: target, message })] } };
        if (isFinal) push.history.$each.push({ by: userId, action: "complete", stage: target });

        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingStage.key": target, "pendingStage.proposedBy": { $ne: userId } },
          { $set: set, $addToSet: { completedStages: target }, $push: push },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "That's no longer pending — refresh");

        if (isFinal) {
          await repo.archivePropertyPost(updated.post);
          await service.notifyCounterparty(updated, userId, actorName, "deal_completed",
            `Deal completed 🎉`, `${actorName} confirmed the final step. Leave each other a review!`);
        } else {
          await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
            `"${stageLabel(target)}" confirmed`, `${actorName} confirmed it — on to ${stageLabel(updated.currentStage)}.`);
        }
        return sendSuccessResponse(res, 200, "Confirmed", { deal: await service.reloadSerialized(id) });
      }

      if (action === "revert") {
        if (deal.pendingStage) {
          if (String(deal.pendingStage.proposedBy) !== String(userId)) {
            return sendErrorResponse(res, 409, "Only the party who proposed this can withdraw it — the other can flag it");
          }
          const updated = await repo.dealFindOneAndUpdate(
            { _id: id, status: "ACTIVE", "pendingStage.proposedBy": userId },
            { $set: { pendingStage: null }, $push: { history: hist({ action: "revert", stage: deal.pendingStage.key, message }) } },
            { new: true }
          );
          if (!updated) return sendErrorResponse(res, 409, "Nothing to withdraw — refresh");
          return sendSuccessResponse(res, 200, "Withdrawn", { deal: await service.reloadSerialized(id) });
        }
        const lastDone = [...(deal.completedStages || [])].reverse().find((k) => k !== "agreed");
        if (!lastDone) return sendErrorResponse(res, 409, "Nothing to undo");
        if (lastDone === "payment") return sendErrorResponse(res, 409, "Can't undo a confirmed payment — cancel the deal instead if it's off");
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", completedStages: lastDone },
          { $pull: { completedStages: lastDone }, $set: { currentStage: lastDone }, $push: { history: hist({ action: "revert", stage: lastDone, message }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already changed — refresh");
        await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${stageLabel(lastDone)} reopened`, `${actorName} moved the deal back to "${stageLabel(lastDone)}".`);
        return sendSuccessResponse(res, 200, "Stage reverted", { deal: await service.reloadSerialized(id) });
      }

      const paid = done.has("payment");

      if (action === "cancel" && !paid) {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 500);
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE" },
          { $set: { status: "CANCELLED", cancelledReason: reason, cancelledBy: userId }, $push: { history: hist({ action: "cancel", stage: deal.currentStage, message: reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Deal already closed — refresh");
        await service.reopenListing(updated, userId);
        await service.notifyCounterparty(updated, userId, actorName, "deal_cancelled",
          `Deal cancelled`, `${actorName} cancelled the deal${reason ? ` — "${reason}"` : ""}. The listing is open again.`);
        return sendSuccessResponse(res, 200, "Deal cancelled", { deal: await service.reloadSerialized(id) });
      }

      if ((action === "cancel" || action === "cancel_request") && paid) {
        const reason = String(req.body?.reason || message || "").trim().slice(0, 500);
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", pendingCancel: null },
          { $set: { pendingCancel: { requestedBy: userId, reason, requestedAt: new Date() } }, $push: { history: hist({ action: "cancel_request", stage: deal.currentStage, message: reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, deal.pendingCancel ? "A cancellation request is already open" : "Refresh and try again");
        await service.notifyCounterparty(updated, userId, actorName, "deal_cancelled",
          `${actorName} wants to cancel the deal`,
          `Payment has been made — cancelling now needs your agreement.${reason ? ` Reason: "${reason}"` : ""}`);
        return sendSuccessResponse(res, 200, "Cancellation requested — waiting for the other party", { deal: await service.reloadSerialized(id) });
      }

      if (action === "cancel_withdraw") {
        if (!deal.pendingCancel) return sendErrorResponse(res, 409, "No cancellation request open");
        if (String(deal.pendingCancel.requestedBy) !== String(userId)) {
          return sendErrorResponse(res, 409, "Only the party who asked to cancel can withdraw it");
        }
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingCancel.requestedBy": userId },
          { $set: { pendingCancel: null }, $push: { history: hist({ action: "revert", stage: deal.currentStage, message: "Cancellation withdrawn" }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${actorName} withdrew the cancellation`, `The deal is back on track.`);
        return sendSuccessResponse(res, 200, "Cancellation withdrawn", { deal: await service.reloadSerialized(id) });
      }

      if (action === "cancel_confirm") {
        if (!deal.pendingCancel) return sendErrorResponse(res, 409, "No cancellation request to accept");
        if (String(deal.pendingCancel.requestedBy) === String(userId)) {
          return sendErrorResponse(res, 409, "The other party has to accept this");
        }
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingCancel.requestedBy": { $ne: userId } },
          { $set: { status: "CANCELLED", cancelledReason: deal.pendingCancel.reason, cancelledBy: deal.pendingCancel.requestedBy, pendingCancel: null }, $push: { history: hist({ action: "cancel_confirm", stage: deal.currentStage, message: deal.pendingCancel.reason }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await service.reopenListing(updated, userId);
        await service.notifyCounterparty(updated, updated.pendingCancel?.requestedBy || userId, actorName, "deal_cancelled",
          `Deal cancelled`, `Both parties agreed to cancel. The listing is open again.`);
        return sendSuccessResponse(res, 200, "Deal cancelled", { deal: await service.reloadSerialized(id) });
      }

      if (action === "propose_amendment") {
        if (!deal.disputed) return sendErrorResponse(res, 400, "Amendments can only be proposed when a deal has an active dispute");
        const amendmentType = String(req.body?.amendmentType || "PRICE_ADJUSTMENT").toUpperCase();
        if (!VALID_AMENDMENT_TYPES.includes(amendmentType)) return sendErrorResponse(res, 400, "Invalid amendment type");
        const adjustmentAmount = Math.max(0, Math.round(Number(req.body?.adjustmentAmount) || 0));
        const extensionDays = Math.max(1, Math.min(30, Math.round(Number(req.body?.extensionDays) || 5)));
        const note = String(req.body?.note || message || "").trim().slice(0, 500);

        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", disputed: true },
          {
            $set: { pendingAmendment: { proposedBy: userId, amendmentType, adjustmentAmount, extensionDays, note, proposedAt: new Date() } },
            $push: { history: hist({ action: "propose_amendment", stage: deal.currentStage, message: `${amendmentType}${adjustmentAmount ? `: -₹${adjustmentAmount.toLocaleString("en-IN")}` : ""}${extensionDays && amendmentType === "TIMELINE_EXTENSION" ? `: +${extensionDays} days` : ""}${note ? ` (${note})` : ""}` }) },
          },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Deal is not disputed or already changed — refresh");
        await service.notifyCounterparty(updated, userId, actorName, "deal_updated",
          `${actorName} proposed a contract amendment`,
          `Resolution Proposal: ${amendmentType}. Review and accept to resolve the dispute.`);
        return sendSuccessResponse(res, 200, "Amendment proposed", { deal: await service.reloadSerialized(id) });
      }

      if (action === "accept_amendment") {
        if (!deal.pendingAmendment) return sendErrorResponse(res, 409, "No amendment pending");
        if (String(deal.pendingAmendment.proposedBy) === String(userId)) return sendErrorResponse(res, 400, "The other party must accept your proposed amendment");
        const amendment = deal.pendingAmendment;
        const set = { disputed: false, disputeDeadline: null, pendingAmendment: null };
        if (amendment.amendmentType === "PRICE_ADJUSTMENT" && amendment.adjustmentAmount > 0) {
          set.agreedPrice = Math.max(0, (deal.agreedPrice || 0) - amendment.adjustmentAmount);
        }
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingAmendment.proposedBy": { $ne: userId } },
          { $set: set, $push: { history: hist({ action: "accept_amendment", stage: deal.currentStage, message: `Amendment accepted by ${actorName}. Dispute resolved!${amendment.adjustmentAmount ? ` New price: ₹${(set.agreedPrice || deal.agreedPrice).toLocaleString("en-IN")}` : ""}` }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await service.notifyCounterparty(updated, userId, actorName, "deal_updated", `Amendment Accepted 🎉`, `${actorName} accepted the amendment. The dispute is cleared and the deal is back on track.`);
        return sendSuccessResponse(res, 200, "Amendment accepted and dispute resolved", { deal: await service.reloadSerialized(id) });
      }

      if (action === "reject_amendment") {
        if (!deal.pendingAmendment) return sendErrorResponse(res, 409, "No amendment pending");
        if (String(deal.pendingAmendment.proposedBy) === String(userId)) return sendErrorResponse(res, 400, "You cannot reject your own proposal");
        const updated = await repo.dealFindOneAndUpdate(
          { _id: id, status: "ACTIVE", "pendingAmendment.proposedBy": { $ne: userId } },
          { $set: { pendingAmendment: null }, $push: { history: hist({ action: "reject_amendment", stage: deal.currentStage, message: message ? `Amendment declined: "${message}"` : "Amendment declined" }) } },
          { new: true }
        );
        if (!updated) return sendErrorResponse(res, 409, "Already resolved — refresh");
        await service.notifyCounterparty(updated, userId, actorName, "deal_updated", `Amendment Declined`, `${actorName} did not accept the proposed amendment.`);
        return sendSuccessResponse(res, 200, "Amendment declined", { deal: await service.reloadSerialized(id) });
      }

      return sendErrorResponse(res, 400, "Invalid action");
    } catch (err) {
      if (service.isDuplicateRequestIdError(err)) {
        const winner = await repo.findDealByRequestId(id, requestId);
        if (winner) return sendSuccessResponse(res, 200, "Already processed", { deal: await service.reloadSerialized(id) });
      }
      throw err;
    }
  } catch (error) {
    logger.error("Error in updateDeal:", error);
    return sendErrorResponse(res, 500, "Failed to update deal");
  }
}

export async function getDealStats(_req, res) {
  try {
    const [byStatus, byStage, cancelReasons, medianDays, attention] = await repo.getDealStatsAggregates();
    const completed = byStatus.find((s) => s._id === "COMPLETED")?.n || 0;
    const cancelled = byStatus.find((s) => s._id === "CANCELLED")?.n || 0;

    return sendSuccessResponse(res, 200, "Deal stats", {
      stats: {
        byStatus,
        activeByStage: byStage,
        topCancelReasons: cancelReasons,
        avgDaysToClose: medianDays[0]?.avg ? Math.round(medianDays[0].avg * 10) / 10 : null,
        completionRate: completed + cancelled > 0 ? Math.round((completed / (completed + cancelled)) * 100) : null,
        attention: (attention || []).map(toAttentionDealDTO),
      },
    });
  } catch (error) {
    logger.error("Error in getDealStats:", error);
    return sendErrorResponse(res, 500, "Failed to load stats");
  }
}

export async function adminListDeals(req, res) {
  try {
    const status = VALID_ADMIN_STATUSES.includes(String(req.query.status)) ? String(req.query.status) : null;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(ADMIN_LIST_MAX_LIMIT, Math.max(ADMIN_LIST_MIN_LIMIT, Number(req.query.limit) || ADMIN_LIST_DEFAULT_LIMIT));
    const filter = status ? { status } : {};

    const [deals, total] = await repo.findAdminDeals(filter, { page, limit });

    return sendSuccessResponse(res, 200, "Deals", {
      deals: (deals || []).map(toAdminDealDTO),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error in adminListDeals:", error);
    return sendErrorResponse(res, 500, "Failed to list deals");
  }
}

export async function adminResolveDealReports(req, res) {
  try {
    const adminId = req.user._id;
    const updated = await repo.findDealByIdAndUpdate(
      req.params.id,
      {
        $set: { "reports.$[r].resolved": true, disputed: false },
        $push: { history: { action: "note", by: adminId, message: "Reports reviewed and closed by the team" } },
      },
      { new: true, arrayFilters: [{ "r.resolved": false }] }
    );
    if (!updated) return sendErrorResponse(res, 404, "Deal not found");
    return sendSuccessResponse(res, 200, "Resolved", { deal: serializeDeal(updated) });
  } catch (error) {
    logger.error("Error in adminResolveDealReports:", error);
    return sendErrorResponse(res, 500, "Failed to resolve");
  }
}

export async function adminForceCancelDeal(req, res) {
  try {
    const adminId = req.user._id;
    const reason = String(req.body?.reason || "").trim().slice(0, 500);
    if (!reason) return sendErrorResponse(res, 400, "A reason is required");

    const updated = await repo.dealFindOneAndUpdate(
      { _id: req.params.id, status: "ACTIVE" },
      {
        $set: { status: "CANCELLED", cancelledReason: `[Admin] ${reason}`, cancelledBy: adminId, pendingStage: null, pendingCancel: null, disputed: false },
        $push: { history: { action: "cancel", by: adminId, message: `Cancelled by the team: ${reason}` } },
      },
      { new: true }
    );
    if (!updated) return sendErrorResponse(res, 409, "Deal isn't active");
    await service.reopenListing(updated, adminId);
    await service.notifyBothParties(updated, adminId, "deal_cancelled",
      "Your deal was cancelled by the team",
      `The deal for this property was cancelled by NearMySpace: ${reason}`);
    return sendSuccessResponse(res, 200, "Deal cancelled", { deal: serializeDeal(updated) });
  } catch (error) {
    logger.error("Error in adminForceCancelDeal:", error);
    return sendErrorResponse(res, 500, "Failed to cancel");
  }
}

export async function addDealAttachment(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;
    const deal = await repo.findDealByIdMutable(id);
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    if (![String(deal.buyer), String(deal.owner)].includes(String(userId))) {
      return sendErrorResponse(res, 403, "You're not a party to this deal");
    }
    if (!req.file?.path) return sendErrorResponse(res, 400, "No file uploaded");

    const name = String(req.body?.name || req.file.originalname || "Document").trim().slice(0, 120);
    const stage = String(req.body?.stage || deal.currentStage || "").trim();
    const category = String(req.body?.category || "OTHER").toUpperCase();
    const safeCategory = VALID_ATTACHMENT_CATEGORIES.includes(category) ? category : "OTHER";

    const reqLat = req.body?.lat != null ? Number(req.body.lat) : (req.body?.latitude != null ? Number(req.body.latitude) : null);
    const reqLng = req.body?.lng != null ? Number(req.body.lng) : (req.body?.longitude != null ? Number(req.body.longitude) : null);
    const { geoVerified, inspectionDistanceMeters, inspectionCoordinates } = await service.computeGeoVerification(safeCategory, reqLat, reqLng, deal.post);

    const cutoff = Date.now() - DUPE_ATTACH_COOLDOWN_MS;
    const dupe = (deal.attachments || []).some(
      (a) => a.name === name && a.stage === stage && String(a.uploadedBy) === String(userId) && new Date(a.uploadedAt).getTime() > cutoff
    );
    if (dupe) return sendSuccessResponse(res, 200, "Document attached", { deal: serializeDeal(deal) });

    const geoBadge = safeCategory === "SITE_INSPECTION"
      ? (geoVerified ? ` [📍 Verified On-Site${inspectionDistanceMeters != null ? ` (${inspectionDistanceMeters}m)` : ""}]` : ` [⚠️ GPS: ${inspectionDistanceMeters != null ? `${inspectionDistanceMeters}m away` : "Unverified"}]`)
      : "";

    await repo.findDealByIdAndUpdate(id, {
      $push: {
        attachments: { url: req.file.path, name, stage, category: safeCategory, uploadedBy: userId, geoVerified, inspectionDistanceMeters, inspectionCoordinates: inspectionCoordinates || undefined },
        history: { action: "attach", stage, by: userId, message: `${name} [${safeCategory}]${geoBadge}` },
      },
    }, { new: true });

    await service.notifyCounterparty(deal, userId, req.user.fullName, "deal_updated",
      `${req.user.fullName} attached a document`, `"${name}" (${safeCategory}) was added to your deal.`);
    return sendSuccessResponse(res, 200, "Document attached", { deal: await service.reloadSerialized(id) });
  } catch (error) {
    logger.error("Error in addDealAttachment:", error);
    return sendErrorResponse(res, 500, "Failed to attach document");
  }
}

export async function verifyDealAttachment(req, res) {
  try {
    const userId = req.user._id;
    const actorName = req.user.fullName || "User";
    const { id, attId } = req.params;

    const deal = await repo.findDealByIdMutable(id);
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    const isParty = String(deal.buyer) === String(userId) || String(deal.owner) === String(userId) || req.user.role === "admin";
    if (!isParty) return sendErrorResponse(res, 403, "Not a party to this deal");

    const attIndex = (deal.attachments || []).findIndex((a) => String(a._id) === String(attId));
    if (attIndex === -1) return sendErrorResponse(res, 404, "Attachment not found");
    const att = deal.attachments[attIndex];
    if (String(att.uploadedBy) === String(userId) && req.user.role !== "admin") {
      return sendErrorResponse(res, 400, "The other party must verify this document, not the uploader");
    }

    const updated = await repo.dealFindOneAndUpdate(
      { _id: id, "attachments._id": attId },
      {
        $set: { "attachments.$.verifiedBy": userId, "attachments.$.verifiedAt": new Date() },
        $push: { history: { action: "verify_doc", stage: att.stage || deal.currentStage, by: userId, message: `Verified document: ${att.name}` } },
      },
      { new: true }
    );

    await service.notifyCounterparty(updated, userId, actorName, "deal_updated", "Document Verified", `${actorName} verified "${att.name}".`);
    return sendSuccessResponse(res, 200, "Document verified successfully", { deal: await service.reloadSerialized(id) });
  } catch (error) {
    logger.error("Error in verifyDealAttachment:", error);
    return sendErrorResponse(res, 500, "Failed to verify document");
  }
}

export async function getDealSummary(req, res) {
  try {
    const userId = req.user._id;
    const { id } = req.params;

    const deal = await repo.findDealByIdFullSummary(id);
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    const isParty = String(deal.buyer?._id) === String(userId) || String(deal.owner?._id) === String(userId) || req.user.role === "admin";
    if (!isParty) return sendErrorResponse(res, 403, "Not authorized to view this deal summary");

    const stages = (DEAL_STAGES[deal.mode] || DEAL_STAGES.BUY).map((s) => ({
      key: s.key, label: s.label, hint: s.hint, completed: (deal.completedStages || []).includes(s.key),
    }));

    const tokenPayload = `${deal._id}:${deal.post?._id}:${deal.buyer?._id}:${deal.owner?._id}:${deal.agreedPrice}:${(deal.completedStages || []).join(",")}:${deal.createdAt}`;
    const verificationToken = deal.verificationToken || crypto.createHash("sha256").update(tokenPayload).digest("hex");
    if (!deal.verificationToken) {
      await repo.updateDealFields({ _id: deal._id }, { $set: { verificationToken } });
    }

    return sendSuccessResponse(res, 200, "Deal summary statement generated", { summary: toDealSummaryDTO(deal, stages, verificationToken) });
  } catch (error) {
    logger.error("Error in getDealSummary:", error);
    return sendErrorResponse(res, 500, "Failed to generate deal summary");
  }
}

export async function removeDealAttachment(req, res) {
  try {
    const userId = req.user._id;
    const { id, attId } = req.params;
    const deal = await repo.findDealByIdAttachments(id);
    if (!deal) return sendErrorResponse(res, 404, "Deal not found");
    const att = (deal.attachments || []).find((a) => String(a._id) === String(attId));
    if (!att) return sendErrorResponse(res, 404, "Attachment not found");
    if (String(att.uploadedBy) !== String(userId)) return sendErrorResponse(res, 403, "Only the person who uploaded it can remove it");
    if (att.verifiedBy && req.user.role !== "admin") return sendErrorResponse(res, 400, "Cannot remove a document that has already been verified by the counterparty");

    await repo.updateDealFields({ _id: id }, { $pull: { attachments: { _id: attId } } });

    try {
      const { extractPublicIdFromUrl } = await import("../../config/cloudinary.js");
      const publicId = extractPublicIdFromUrl(att.url);
      if (publicId) {
        const { enqueueMediaCleanup } = await import("../../jobs/producers/cleanup.producer.js");
        await enqueueMediaCleanup([publicId]);
      }
    } catch (e) {
      logger.warn("deal attachment cloudinary cleanup failed (non-fatal):", e?.message);
    }

    return sendSuccessResponse(res, 200, "Removed", { deal: await service.reloadSerialized(id) });
  } catch (error) {
    logger.error("Error in removeDealAttachment:", error);
    return sendErrorResponse(res, 500, "Failed to remove attachment");
  }
}

export async function nudgeStalledDeals(req, res) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get("x-cron-secret") !== secret) return sendErrorResponse(res, 401, "Unauthorized");

    const staleBefore = new Date(Date.now() - STALLED_AFTER_DAYS * 86400000);
    const nudgeBefore = new Date(Date.now() - NUDGE_COOLDOWN_DAYS * 86400000);
    const stalled = await repo.findStalledDeals(staleBefore, nudgeBefore) || [];

    if (stalled.length) {
      const { enqueueDealNudge } = await import("../../jobs/producers/fanout.producer.js");
      await enqueueDealNudge(stalled.map((d) => d._id));
    }
    return sendSuccessResponse(res, 200, "Stalled deals swept", { checked: stalled.length, nudged: stalled.length });
  } catch (error) {
    logger.error("Error in nudgeStalledDeals:", error);
    return sendErrorResponse(res, 500, "Sweep failed");
  }
}

export async function verifyPublicClosingStatement(req, res) {
  try {
    const { token } = req.params;
    if (!token || typeof token !== "string" || token.length < 8) return sendErrorResponse(res, 400, "Invalid verification token");

    const rawId = token.startsWith("deal-") ? token.replace("deal-", "") : token;
    let deal = null;

    if (mongoose.Types.ObjectId.isValid(rawId)) {
      deal = await repo.findDealByIdForVerification(rawId);
    }
    if (!deal) deal = await repo.findDealByVerificationToken(token);

    if (!deal) {
      const candidates = await repo.findVerificationCandidates();
      for (const cand of candidates) {
        const payload = `${cand._id}:${cand.post?._id}:${cand.buyer?._id}:${cand.owner?._id}:${cand.agreedPrice}:${(cand.completedStages || []).join(",")}:${cand.createdAt}`;
        const computed = crypto.createHash("sha256").update(payload).digest("hex");
        if (computed === token) {
          deal = cand;
          await repo.updateDealFields({ _id: cand._id }, { $set: { verificationToken: token } });
          break;
        }
      }
    }

    if (!deal) return sendErrorResponse(res, 404, "No verified transaction statement matches this digital fingerprint");

    const tokenPayload = `${deal._id}:${deal.post?._id}:${deal.buyer?._id}:${deal.owner?._id}:${deal.agreedPrice}:${(deal.completedStages || []).join(",")}:${deal.createdAt}`;
    const computedToken = crypto.createHash("sha256").update(tokenPayload).digest("hex");
    if (!deal.verificationToken) await repo.updateDealFields({ _id: deal._id }, { $set: { verificationToken: computedToken } });
    const isTamperFree = deal.verificationToken === token || computedToken === token || rawId === String(deal._id);

    const stages = (DEAL_STAGES[deal.mode] || DEAL_STAGES.BUY).map((s) => ({
      key: s.key, label: s.label, hint: s.hint, completed: (deal.completedStages || []).includes(s.key),
    }));

    return sendSuccessResponse(res, 200, "Transaction statement verified", toPublicVerificationDTO(deal, stages, token, isTamperFree));
  } catch (error) {
    logger.error("Error in verifyPublicClosingStatement:", error);
    return sendErrorResponse(res, 500, "Verification check failed");
  }
}
