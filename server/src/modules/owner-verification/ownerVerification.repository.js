import OwnerVerificationRequest from "../../models/OwnerVerificationRequest.model.js";
import User from "../../models/User.model.js";

export async function findActiveForUser(userId) {
  // "Active" = the most recent one, whatever its status — a rejected
  // request still needs to be visible to the user so they know to resubmit.
  return OwnerVerificationRequest.findOne({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function findPendingForUser(userId) {
  return OwnerVerificationRequest.findOne({ user: userId, status: "PENDING" }).lean();
}

export async function create({ userId, docType, docUrl, note }) {
  return OwnerVerificationRequest.create({ user: userId, docType, docUrl, note });
}

export async function listPending({ page = 1, limit = 20 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    OwnerVerificationRequest.find({ status: "PENDING" })
      .populate("user", "fullName email profilePic city")
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OwnerVerificationRequest.countDocuments({ status: "PENDING" }),
  ]);
  return { items, total, page, limit };
}

export async function findById(id) {
  return OwnerVerificationRequest.findById(id);
}

export async function markReviewed(id, { status, reviewNote, reviewerId }) {
  return OwnerVerificationRequest.findByIdAndUpdate(
    id,
    { $set: { status, reviewNote: reviewNote || "", reviewedAt: new Date(), reviewedBy: reviewerId } },
    { new: true }
  );
}

export async function setUserOwnerVerified(userId, verified) {
  await User.updateOne(
    { _id: userId },
    { $set: { isOwnerVerified: verified, ownerVerifiedAt: verified ? new Date() : null } }
  );
}
