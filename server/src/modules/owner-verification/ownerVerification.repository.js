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

export async function create({ userId, docType, docUrl, note, docNumber }) {
  return OwnerVerificationRequest.create({ user: userId, docType, docUrl, note, docNumber });
}

// `status` is one of REQUEST_STATUSES, or "ALL" to see the full history —
// approved/rejected requests are never deleted, just excluded from the
// PENDING queue by default, so admins can still look a reviewed request up
// later (e.g. "when was this owner verified, who reviewed it").
export async function listByStatus({ status = "PENDING", page = 1, limit = 20 } = {}) {
  const filter = status === "ALL" ? {} : { status };
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    OwnerVerificationRequest.find(filter)
      .populate("user", "fullName email profilePic city isOwnerVerified")
      .populate("reviewedBy", "fullName")
      .sort(status === "PENDING" ? { createdAt: 1 } : { reviewedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    OwnerVerificationRequest.countDocuments(filter),
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
