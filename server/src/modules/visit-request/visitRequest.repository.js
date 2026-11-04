import VisitRequest from "../../models/VisitRequest.model.js";
import VisitUsage from "../../models/VisitUsage.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import User from "../../models/User.model.js";
import { ACTIVE_STATUSES, VISIT_CONFLICT_MS } from "./visitRequest.constants.js";

export function findReplayByRequestId(postId, requesterId, requestId) {
  return VisitRequest.findOne({ post: postId, requester: requesterId, "history.requestId": requestId }).lean();
}

export function findPostById(postId) {
  return PropertyPost.findById(postId).select("title author status isDeleted postType").lean();
}

export function findExistingActiveVisit(postId, requesterId) {
  return VisitRequest.findOne({ post: postId, requester: requesterId, status: { $in: ACTIVE_STATUSES.concat("CONFIRMED") } }).lean();
}

export function countActiveVisitRequests(requesterId) {
  return VisitRequest.countDocuments({ requester: requesterId, status: { $in: ACTIVE_STATUSES } });
}

export function reserveDailyUsage(requesterId, dateBucket, dailyLimit) {
  return VisitUsage.findOneAndUpdate(
    { user: requesterId, dateBucket, count: { $lt: dailyLimit } },
    { $inc: { count: 1 } },
    { upsert: true, new: true }
  );
}

export function refundDailyUsage(user, dateBucket) {
  return VisitUsage.updateOne(
    { user, dateBucket, count: { $gt: 0 } },
    { $inc: { count: -1 } }
  );
}

export function createVisitRequest(data) {
  return VisitRequest.create(data);
}

export function incrementVisitRequestCount(postId) {
  return PropertyPost.updateOne({ _id: postId }, { $inc: { visitRequestCount: 1 } });
}

export function findVisitByIdPopulated(visitId) {
  return VisitRequest.findById(visitId).populate("post", "title author");
}

export function findVisitConflict(visitId, slot, requester, owner) {
  return VisitRequest.findOne({
    _id: { $ne: visitId },
    status: "CONFIRMED",
    confirmedSlot: {
      $gte: new Date(slot.getTime() - VISIT_CONFLICT_MS),
      $lte: new Date(slot.getTime() + VISIT_CONFLICT_MS),
    },
    $or: [
      { requester }, { owner: requester },
      { requester: owner }, { owner },
    ],
  }).select("confirmedSlot").lean();
}

export function findPostVisitRequests(postId, filter) {
  return VisitRequest.find(filter)
    .populate("requester", "fullName profilePic")
    .populate("owner", "fullName profilePic")
    .sort({ updatedAt: -1 })
    .lean();
}

export function findMyVisitForPost(postId, requesterId) {
  return VisitRequest.findOne({ post: postId, requester: requesterId })
    .sort({ createdAt: -1 })
    .populate("owner", "fullName profilePic")
    .lean();
}

export function findUserById(userId) {
  return User.findById(userId).select("fullName email").lean();
}
