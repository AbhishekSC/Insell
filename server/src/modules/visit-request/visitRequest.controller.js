import { sendErrorResponse, sendSuccessResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import { planFor, istDayBucket, nextIstMidnight } from "../../config/plans.js";
import * as NotificationService from "../../services/NotificationService.js";
import * as repo from "./visitRequest.repository.js";
import { ACTIVE_STATUSES, ALL_CHANNELS } from "./visitRequest.constants.js";
import {
  parseSlots,
  fmtSlot,
  findReplay,
  refundVisitUsage,
  sendVisitConfirmationEmails,
  notify,
} from "./visitRequest.service.js";

// POST /visits/posts/:postId/visits
export async function createVisitRequest(req, res) {
  try {
    const { postId } = req.params;
    const requesterId = req.user?._id;
    if (!requesterId) return sendErrorResponse(res, 401, "Unauthorized");

    const slots = parseSlots(req.body?.slots);
    if (slots.length === 0) {
      return sendErrorResponse(res, 400, "Pick at least one future time slot");
    }
    const mode = req.body?.mode === "VIDEO" ? "VIDEO" : "IN_PERSON";
    const note = String(req.body?.note || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (requestId) {
      const replay = await repo.findReplayByRequestId(postId, requesterId, requestId);
      if (replay) return sendSuccessResponse(res, 200, "Visit request already submitted", { visit: replay });
    }

    const post = await repo.findPostById(postId);
    if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
    if (String(post.author) === String(requesterId)) {
      return sendErrorResponse(res, 400, "You can't request a visit on your own listing");
    }
    if (post.status !== "PUBLISHED") return sendErrorResponse(res, 400, "This listing isn't accepting visit requests");
    if (String(post.postType || "").startsWith("REQUIREMENT_")) {
      return sendErrorResponse(res, 400, "Visit requests don't apply to requirement posts");
    }

    const existing = await repo.findExistingActiveVisit(postId, requesterId);
    if (existing) return sendErrorResponse(res, 409, "You already have an open visit request on this listing");

    // Rate limits — entitlement-driven (see config/plans.js), not `if isPremium`.
    const plan = planFor(req.user);

    // Cap on how many visits you can have in flight at once.
    const activeCount = await repo.countActiveVisitRequests(requesterId);
    if (activeCount >= plan.activeVisitRequests) {
      return sendErrorResponse(
        res,
        429,
        `You have ${activeCount} visit requests still awaiting a reply. Close some out before sending more.`,
        { code: "VISIT_LIMIT_REACHED", scope: "active", limit: plan.activeVisitRequests, plan: plan.key }
      );
    }

    // Daily cap — reserved atomically so a double-submit can't slip past it.
    const dateBucket = istDayBucket();
    let reserved = false;
    try {
      const usage = await repo.reserveDailyUsage(requesterId, dateBucket, plan.dailyVisitRequests);
      reserved = !!usage;
    } catch (err) {
      if (err?.code !== 11000) throw err;
      reserved = false;
    }
    if (!reserved) {
      return sendErrorResponse(
        res,
        429,
        `You've hit today's limit of ${plan.dailyVisitRequests} visit requests. It resets at midnight.`,
        { code: "VISIT_LIMIT_REACHED", scope: "daily", limit: plan.dailyVisitRequests, plan: plan.key, resetAt: nextIstMidnight() }
      );
    }

    let visit;
    try {
      visit = await repo.createVisitRequest({
        post: postId,
        requester: requesterId,
        owner: post.author,
        status: "PENDING",
        mode,
        proposedSlots: slots,
        lastActionBy: requesterId,
        note,
        history: [{ action: "request", actorRole: "requester", by: requesterId, slots, message: note, requestId }],
      });
    } catch (err) {
      if (err?.code === 11000) {
        const winner = await repo.findReplayByRequestId(postId, requesterId, requestId);
        if (winner) {
          await refundVisitUsage(requesterId, dateBucket);
          return sendSuccessResponse(res, 200, "Visit request already submitted", { visit: winner });
        }
      }
      await refundVisitUsage(requesterId, dateBucket);
      throw err;
    }

    // Demand counter for the card — best-effort, never blocks the response.
    repo.incrementVisitRequestCount(postId).catch((e) =>
      logger.error("visitRequestCount bump failed (non-fatal):", e)
    );

    await NotificationService.send({
      recipientId: post.author,
      actorId: requesterId,
      type: "visit_requested",
      title: `${req.user.fullName} requested a visit`,
      message: `${req.user.fullName} wants to visit "${post.title}" — ${slots.map(fmtSlot).join(" or ")}`,
      pushBody: `Proposed: ${slots.map(fmtSlot).join(" / ")}`,
      data: { propertyPost: post._id, visitRequest: visit._id },
      channels: ALL_CHANNELS,
    });

    return sendSuccessResponse(res, 201, "Visit request submitted", { visit });
  } catch (error) {
    logger.error("Error creating visit request:", error);
    return sendErrorResponse(res, 500, "Failed to submit visit request");
  }
}

// PATCH /visits/:visitId   body: { action, slot?, slots?, message?, requestId? }
export async function respondToVisitRequest(req, res) {
  try {
    const { visitId } = req.params;
    const userId = req.user?._id;
    const action = String(req.body?.action || "").trim();
    const message = String(req.body?.message || "").trim().slice(0, 500);
    const requestId = req.body?.requestId ? String(req.body.requestId) : undefined;

    if (!["confirm", "propose", "decline", "cancel"].includes(action)) {
      return sendErrorResponse(res, 400, "Invalid action");
    }

    const visit = await repo.findVisitByIdPopulated(visitId);
    if (!visit) return sendErrorResponse(res, 404, "Visit request not found");

    const isRequester = String(visit.requester) === String(userId);
    const isOwner = String(visit.owner) === String(userId);
    if (!isRequester && !isOwner) return sendErrorResponse(res, 403, "You're not a party to this visit request");

    const replay = findReplay(visit, requestId);
    if (replay) return sendSuccessResponse(res, 200, "Already processed", { visit });

    if (!ACTIVE_STATUSES.includes(visit.status) && !(action === "cancel" && visit.status === "CONFIRMED")) {
      return sendErrorResponse(res, 409, "This visit request is no longer open for that action");
    }

    const actorRole = isOwner ? "owner" : "requester";
    const counterpartyId = isOwner ? visit.requester : visit.owner;
    const isMyTurn = String(visit.lastActionBy) !== String(userId);

    // cancel — the requester can always pull out (even after confirming).
    if (action === "cancel") {
      if (!isRequester) return sendErrorResponse(res, 403, "Only the requester can cancel");
      visit.status = "CANCELLED";
      visit.history.push({ action: "cancel", actorRole, by: userId, message, requestId });
      await visit.save();
      notify(counterpartyId, userId, "visit_cancelled", `${req.user.fullName} cancelled the visit`, `${req.user.fullName} cancelled the visit for "${visit.post.title}"`, visit, req.user.fullName).catch((e) => logger.warn("visit cancel notify failed (non-fatal):", e?.message));
      return sendSuccessResponse(res, 200, "Visit cancelled", { visit });
    }

    // decline — owner only.
    if (action === "decline") {
      if (!isOwner) return sendErrorResponse(res, 403, "Only the owner can decline");
      visit.status = "DECLINED";
      visit.history.push({ action: "decline", actorRole, by: userId, message, requestId });
      await visit.save();
      notify(counterpartyId, userId, "visit_declined", `${req.user.fullName} declined the visit`, `${req.user.fullName} declined the visit for "${visit.post.title}"`, visit, req.user.fullName).catch((e) => logger.warn("visit decline notify failed (non-fatal):", e?.message));
      return sendSuccessResponse(res, 200, "Visit declined", { visit });
    }

    // confirm / propose require it to be your turn.
    if (!isMyTurn) {
      return sendErrorResponse(res, 409, "It's the other party's turn to respond");
    }

    if (action === "confirm") {
      const slot = new Date(req.body?.slot);
      const ok = slot instanceof Date && !Number.isNaN(slot.getTime())
        && visit.proposedSlots.some((s) => new Date(s).getTime() === slot.getTime());
      if (!ok) return sendErrorResponse(res, 400, "Pick one of the proposed slots to confirm");

      // Neither party can have another confirmed visit overlapping this slot.
      const conflict = await repo.findVisitConflict(visit._id, slot, visit.requester, visit.owner);
      if (conflict) {
        return sendErrorResponse(
          res,
          409,
          `That time clashes with another confirmed visit around ${fmtSlot(conflict.confirmedSlot)}. Pick a different slot.`,
          { code: "VISIT_TIME_CONFLICT" }
        );
      }

      visit.status = "CONFIRMED";
      visit.confirmedSlot = slot;
      visit.lastActionBy = userId;
      visit.history.push({ action: "confirm", actorRole, by: userId, slot, message, requestId });
      await visit.save();
      notify(counterpartyId, userId, "visit_confirmed", `Visit confirmed for ${fmtSlot(slot)}`, `${req.user.fullName} confirmed the visit for "${visit.post.title}" on ${fmtSlot(slot)}`, visit, req.user.fullName).catch((e) => logger.warn("visit confirm notify failed (non-fatal):", e?.message));
      // Both sides get an email once — fire-and-forget, outside any txn.
      sendVisitConfirmationEmails(visit, slot).catch((e) => logger.error("visit confirmation email failed (non-fatal):", e));
      return sendSuccessResponse(res, 200, "Visit confirmed", { visit });
    }

    // propose — reschedule with new slots, flips the turn.
    const newSlots = parseSlots(req.body?.slots);
    if (newSlots.length === 0) return sendErrorResponse(res, 400, "Propose at least one future time slot");
    visit.status = "RESCHEDULE_PROPOSED";
    visit.proposedSlots = newSlots;
    visit.confirmedSlot = null;
    visit.lastActionBy = userId;
    visit.history.push({ action: "propose", actorRole, by: userId, slots: newSlots, message, requestId });
    await visit.save();
    notify(counterpartyId, userId, "visit_rescheduled", `${req.user.fullName} proposed a new time`, `${req.user.fullName} proposed new times for "${visit.post.title}" — ${newSlots.map(fmtSlot).join(" or ")}`, visit, req.user.fullName).catch((e) => logger.warn("visit reschedule notify failed (non-fatal):", e?.message));
    return sendSuccessResponse(res, 200, "New times proposed", { visit });
  } catch (error) {
    logger.error("Error responding to visit request:", error);
    return sendErrorResponse(res, 500, "Failed to update visit request");
  }
}

// GET /visits/posts/:postId/visits — owner sees all, requester sees own.
export async function getPostVisitRequests(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;
    const post = await repo.findPostById(postId);
    if (!post) return sendErrorResponse(res, 404, "Post not found");

    const filter = { post: postId };
    if (String(post.author) !== String(userId)) filter.requester = userId;

    const visits = await repo.findPostVisitRequests(postId, filter);
    return sendSuccessResponse(res, 200, "Visit requests retrieved", { visits });
  } catch (error) {
    logger.error("Error fetching visit requests:", error);
    return sendErrorResponse(res, 500, "Failed to fetch visit requests");
  }
}

// GET /visits/posts/:postId/visits/mine
export async function getMyVisitForPost(req, res) {
  try {
    const { postId } = req.params;
    const visit = await repo.findMyVisitForPost(postId, req.user?._id);
    return sendSuccessResponse(res, 200, "Visit request retrieved", { visit: visit || null });
  } catch (error) {
    logger.error("Error fetching my visit request:", error);
    return sendErrorResponse(res, 500, "Failed to fetch visit request");
  }
}
