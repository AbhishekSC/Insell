import VisitRequest from "../models/VisitRequest.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import * as NotificationService from "../services/NotificationService.js";
import { NotificationChannel } from "../services/NotificationService.js";

const ACTIVE_STATUSES = ["PENDING", "RESCHEDULE_PROPOSED"];
const ALL_CHANNELS = [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE];

function parseSlots(raw) {
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  return raw
    .map((s) => new Date(s))
    .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()) && d.getTime() > now)
    .slice(0, 3);
}

function fmtSlot(d) {
  return new Date(d).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function findReplay(visit, requestId) {
  if (!requestId || !visit?.history?.length) return null;
  return visit.history.find((h) => h.requestId === requestId) || null;
}

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
      const replay = await VisitRequest.findOne({ post: postId, requester: requesterId, "history.requestId": requestId });
      if (replay) return sendSuccessResponse(res, 200, "Visit request already submitted", { visit: replay });
    }

    const post = await PropertyPost.findById(postId).select("title author status isDeleted postType");
    if (!post || post.isDeleted) return sendErrorResponse(res, 404, "Post not found");
    if (String(post.author) === String(requesterId)) {
      return sendErrorResponse(res, 400, "You can't request a visit on your own listing");
    }
    if (post.status !== "PUBLISHED") return sendErrorResponse(res, 400, "This listing isn't accepting visit requests");
    if (String(post.postType || "").startsWith("REQUIREMENT_")) {
      return sendErrorResponse(res, 400, "Visit requests don't apply to requirement posts");
    }

    const existing = await VisitRequest.findOne({ post: postId, requester: requesterId, status: { $in: ACTIVE_STATUSES.concat("CONFIRMED") } });
    if (existing) return sendErrorResponse(res, 409, "You already have an open visit request on this listing");

    let visit;
    try {
      visit = await VisitRequest.create({
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
        const winner = await VisitRequest.findOne({ post: postId, requester: requesterId, "history.requestId": requestId });
        if (winner) return sendSuccessResponse(res, 200, "Visit request already submitted", { visit: winner });
      }
      throw err;
    }

    await NotificationService.send({
      recipientId: post.author,
      actorId: requesterId,
      type: "visit_requested",
      title: `${req.user.fullName} requested a visit`,
      message: `${req.user.fullName} wants to visit "${post.title}" — ${slots.map(fmtSlot).join(" or ")}`,
      pushBody: `Proposed: ${slots.map(fmtSlot).join(" / ")}`,
      data: { propertyPost: post._id, visitRequest: visit._id, url: `/property/${post._id}` },
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

    const visit = await VisitRequest.findById(visitId).populate("post", "title author");
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
      await notify(counterpartyId, userId, "visit_cancelled", `${req.user.fullName} cancelled the visit`, `${req.user.fullName} cancelled the visit for "${visit.post.title}"`, visit, req.user.fullName);
      return sendSuccessResponse(res, 200, "Visit cancelled", { visit });
    }

    // decline — owner only.
    if (action === "decline") {
      if (!isOwner) return sendErrorResponse(res, 403, "Only the owner can decline");
      visit.status = "DECLINED";
      visit.history.push({ action: "decline", actorRole, by: userId, message, requestId });
      await visit.save();
      await notify(counterpartyId, userId, "visit_declined", `${req.user.fullName} declined the visit`, `${req.user.fullName} declined the visit for "${visit.post.title}"`, visit, req.user.fullName);
      return sendSuccessResponse(res, 200, "Visit declined", { visit });
    }

    // confirm / propose require it to be your turn (you can't confirm or
    // counter your own outstanding proposal).
    if (!isMyTurn) {
      return sendErrorResponse(res, 409, "It's the other party's turn to respond");
    }

    if (action === "confirm") {
      const slot = new Date(req.body?.slot);
      const ok = slot instanceof Date && !Number.isNaN(slot.getTime())
        && visit.proposedSlots.some((s) => new Date(s).getTime() === slot.getTime());
      if (!ok) return sendErrorResponse(res, 400, "Pick one of the proposed slots to confirm");
      visit.status = "CONFIRMED";
      visit.confirmedSlot = slot;
      visit.lastActionBy = userId;
      visit.history.push({ action: "confirm", actorRole, by: userId, slot, message, requestId });
      await visit.save();
      await notify(counterpartyId, userId, "visit_confirmed", `Visit confirmed for ${fmtSlot(slot)}`, `${req.user.fullName} confirmed the visit for "${visit.post.title}" on ${fmtSlot(slot)}`, visit, req.user.fullName);
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
    await notify(counterpartyId, userId, "visit_rescheduled", `${req.user.fullName} proposed a new time`, `${req.user.fullName} proposed new times for "${visit.post.title}" — ${newSlots.map(fmtSlot).join(" or ")}`, visit, req.user.fullName);
    return sendSuccessResponse(res, 200, "New times proposed", { visit });
  } catch (error) {
    logger.error("Error responding to visit request:", error);
    return sendErrorResponse(res, 500, "Failed to update visit request");
  }
}

async function notify(recipientId, actorId, type, title, msg, visit, actorName) {
  await NotificationService.send({
    recipientId, actorId, type, title, message: msg,
    pushBody: actorName ? `${actorName}: ${title}` : title,
    data: { propertyPost: visit.post._id || visit.post, visitRequest: visit._id, url: `/property/${visit.post._id || visit.post}` },
    channels: ALL_CHANNELS,
  }).catch((e) => logger.error("visit notify failed (non-fatal):", e));
}

// GET /visits/posts/:postId/visits — owner sees all, requester sees own.
export async function getPostVisitRequests(req, res) {
  try {
    const { postId } = req.params;
    const userId = req.user?._id;
    const post = await PropertyPost.findById(postId).select("author");
    if (!post) return sendErrorResponse(res, 404, "Post not found");

    const filter = { post: postId };
    if (String(post.author) !== String(userId)) filter.requester = userId;

    const visits = await VisitRequest.find(filter)
      .populate("requester", "fullName profilePic")
      .populate("owner", "fullName profilePic")
      .sort({ updatedAt: -1 })
      .lean();
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
    const visit = await VisitRequest.findOne({ post: postId, requester: req.user?._id })
      .sort({ createdAt: -1 })
      .populate("owner", "fullName profilePic")
      .lean();
    return sendSuccessResponse(res, 200, "Visit request retrieved", { visit: visit || null });
  } catch (error) {
    logger.error("Error fetching my visit request:", error);
    return sendErrorResponse(res, 500, "Failed to fetch visit request");
  }
}
