import mongoose from "mongoose";
import Deal, { DEAL_STAGES } from "../../models/Deal.model.js";
import Offer from "../../models/Offer.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import {
  DEAL_POPULATE_BUYER,
  DEAL_POPULATE_OWNER,
  DEAL_POPULATE_POST_LIST,
  DEAL_POPULATE_POST_SUMMARY,
  DEAL_POPULATE_POST_VERIFY,
  ADMIN_ATTENTION_LIMIT,
  ADMIN_TOP_CANCEL_REASONS_LIMIT,
} from "./deal.constants.js";

export { DEAL_STAGES };

export async function findDealByOffer(offerId, session) {
  return Deal.findOne({ offer: offerId }).session(session || null);
}

export async function findOfferByIdPopulated(offerId, session) {
  return Offer.findById(offerId)
    .populate("post", "listingType postType title author")
    .session(session || null)
    .lean();
}

export async function createDeal(data, session) {
  return Deal.create([data], session ? { session } : {});
}

export async function findDealById(id) {
  return Deal.findById(id).lean();
}

export async function findDealByIdMutable(id) {
  return Deal.findById(id);
}

export async function findDealByIdPopulated(id) {
  return Deal.findById(id)
    .populate("buyer", DEAL_POPULATE_BUYER)
    .populate("owner", DEAL_POPULATE_OWNER)
    .lean();
}

export async function findMyDeals(userId) {
  return Deal.find({ $or: [{ buyer: userId }, { owner: userId }] })
    .sort({ updatedAt: -1 })
    .populate("post", DEAL_POPULATE_POST_LIST)
    .populate("buyer", DEAL_POPULATE_BUYER)
    .populate("owner", DEAL_POPULATE_OWNER)
    .lean();
}

export async function findDealForPostByStatus(postId, userId, status) {
  const filter = {
    post: postId,
    $or: [{ buyer: userId }, { owner: userId }],
    ...(status ? { status } : {}),
  };
  return Deal.findOne(filter).sort({ updatedAt: -1 });
}

export async function findRecentAcceptedOffer(postId, userId, cutoffDate) {
  return Offer.findOne({
    post: postId,
    status: "accepted",
    updatedAt: { $gte: cutoffDate },
    $or: [{ buyer: userId }, { owner: userId }],
  }).select("_id").lean();
}

export async function findDealByRequestId(id, requestId) {
  return Deal.findOne({ _id: id, "history.requestId": requestId }).lean();
}

export async function updateDealPush(id, update) {
  return Deal.updateOne({ _id: id }, update);
}

export async function dealFindOneAndUpdate(filter, update, options = {}) {
  return Deal.findOneAndUpdate(filter, update, options);
}

export async function findDealByIdFullSummary(id) {
  return Deal.findById(id)
    .populate("post", DEAL_POPULATE_POST_SUMMARY)
    .populate("buyer", "fullName email phone isVerified profilePic")
    .populate("owner", "fullName email phone isVerified profilePic")
    .populate("attachments.verifiedBy", "fullName")
    .populate("paymentConfirmedBy", "fullName")
    .lean();
}

export async function updateDealFields(filter, update) {
  return Deal.updateOne(filter, update);
}

export async function findDealByIdAttachments(id) {
  return Deal.findById(id).select("attachments").lean();
}

export async function findDealByIdAndUpdate(id, update, options = {}) {
  return Deal.findByIdAndUpdate(id, update, options);
}

export async function reopenPropertyListing(postId) {
  return PropertyPost.updateOne(
    { _id: postId, offerStatus: "ACCEPTED" },
    { $set: { offerStatus: "OPEN" } },
  );
}

export async function declineOffer(offerId, actorId) {
  return Offer.updateOne(
    { _id: offerId, status: "accepted" },
    { $set: { status: "declined", lastActionBy: actorId } },
  ).catch(() => {});
}

export async function archivePropertyPost(postId) {
  return PropertyPost.updateOne(
    { _id: postId },
    { $set: { status: "ARCHIVED" } },
  ).catch(() => {});
}

export async function findPropertyPostCoordinates(postId) {
  return PropertyPost.findById(postId).select("latitude longitude").lean();
}

export async function getDealStatsAggregates() {
  return Promise.all([
    Deal.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
    Deal.aggregate([{ $match: { status: "ACTIVE" } }, { $group: { _id: "$currentStage", n: { $sum: 1 } } }]),
    Deal.aggregate([
      { $match: { status: "CANCELLED", cancelledReason: { $ne: "" } } },
      { $group: { _id: "$cancelledReason", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: ADMIN_TOP_CANCEL_REASONS_LIMIT },
    ]),
    Deal.aggregate([
      { $match: { status: "COMPLETED", completedAt: { $ne: null } } },
      { $project: { days: { $divide: [{ $subtract: ["$completedAt", "$createdAt"] }, 86400000] } } },
      { $group: { _id: null, avg: { $avg: "$days" } } },
    ]),
    Deal.find({
      $or: [{ "reports.resolved": false }, { disputed: true, status: "ACTIVE" }],
    })
      .sort({ updatedAt: -1 })
      .limit(ADMIN_ATTENTION_LIMIT)
      .populate("post", "title")
      .populate("buyer", "fullName")
      .populate("owner", "fullName")
      .select("post buyer owner status currentStage mode disputed reports agreedPrice updatedAt")
      .lean(),
  ]);
}

export async function findAdminDeals(filter, { page, limit }) {
  return Promise.all([
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
}

export async function findStalledDeals(staleBefore, nudgeBefore) {
  return Deal.find({
    status: "ACTIVE",
    updatedAt: { $lt: staleBefore },
    $or: [{ lastNudgedAt: null }, { lastNudgedAt: { $lt: nudgeBefore } }],
  })
    .populate("post", "title")
    .limit(200)
    .lean();
}

export async function findDealByIdForVerification(id) {
  return Deal.findById(id)
    .populate("post", DEAL_POPULATE_POST_VERIFY)
    .populate("buyer", "fullName isVerified email")
    .populate("owner", "fullName isVerified email")
    .lean();
}

export async function findDealByVerificationToken(token) {
  return Deal.findOne({ verificationToken: token })
    .populate("post", DEAL_POPULATE_POST_VERIFY)
    .populate("buyer", "fullName isVerified email")
    .populate("owner", "fullName isVerified email")
    .lean();
}

export async function findVerificationCandidates() {
  return Deal.find({ status: { $in: ["COMPLETED", "ACTIVE"] } })
    .populate("post", DEAL_POPULATE_POST_VERIFY)
    .populate("buyer", "fullName isVerified email")
    .populate("owner", "fullName isVerified email")
    .lean();
}
