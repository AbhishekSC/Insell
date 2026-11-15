import PGResidency from "../../models/PGResidency.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";

export async function create(data) {
  return PGResidency.create(data);
}

export async function findById(residencyId) {
  return PGResidency.findById(residencyId)
    .populate("tenant", "fullName profilePic phone email")
    .populate("pg", "title city locality")
    .populate("moveInConditionReport")
    .populate("moveOutConditionReport")
    .lean();
}

export async function findActiveByTenantAndPg(tenantId, pgId) {
  return PGResidency.findOne({ tenant: tenantId, pg: pgId, status: { $in: ["active", "notice_period"] } }).lean();
}

export async function findPendingByTenantAndPg(tenantId, pgId) {
  return PGResidency.findOne({ tenant: tenantId, pg: pgId, status: { $in: ["pending", "approved"] } }).lean();
}

export async function findByTenant(tenantId, { page = 1, limit = 10 } = {}) {
  const skip = (page - 1) * limit;
  const [residencies, total] = await Promise.all([
    PGResidency.find({ tenant: tenantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("pg", "title city locality mediaUrls")
      .lean(),
    PGResidency.countDocuments({ tenant: tenantId }),
  ]);
  return { residencies, total };
}

export async function findByPg(pgId, { status } = {}) {
  const filter = { pg: pgId };
  if (status) filter.status = status;
  return PGResidency.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("tenant", "fullName profilePic phone")
    .lean();
}

export async function findPendingByPg(pgId) {
  return PGResidency.find({ pg: pgId, status: "pending" })
    .sort({ createdAt: -1 })
    .populate("tenant", "fullName profilePic phone email")
    .lean();
}

export async function findPendingByOwner(ownerId) {
  const ownerPgs = await PropertyPost.find({
    author: ownerId,
    postType: "PG_HOSTEL",
    isDeleted: { $ne: true },
  }).select("_id").lean();

  const pgIds = ownerPgs.map((p) => p._id);
  if (!pgIds.length) return [];

  return PGResidency.find({ pg: { $in: pgIds }, status: "pending" })
    .sort({ createdAt: -1 })
    .populate("tenant", "fullName profilePic phone email")
    .populate("pg", "title city locality")
    .lean();
}

export async function updateById(residencyId, updates) {
  return PGResidency.findByIdAndUpdate(residencyId, updates, { new: true }).lean();
}

export async function findPgPost(pgId) {
  return PropertyPost.findById(pgId).select("postType author title").lean();
}

export async function getActiveResidentCount(pgId) {
  return PGResidency.countDocuments({ pg: pgId, status: { $in: ["active", "notice_period"] } });
}

export async function getPendingDeposits(pgId) {
  return PGResidency.find({
    pg: pgId,
    status: "moved_out",
    depositRefunded: false,
    depositAmount: { $gt: 0 },
  })
    .select("tenant depositAmount moveOutDate depositDueDate")
    .populate("tenant", "fullName phone")
    .lean();
}

export async function getBookingStatusForTenant(tenantId, pgId) {
  const active = await PGResidency.findOne({
    tenant: tenantId,
    pg: pgId,
    status: { $in: ["pending", "approved", "active", "notice_period"] },
  })
    .select("status roomType preferredMoveInDate moveInDate monthlyRent depositAmount ownerNote rejectedAt approvedAt assignedRoom assignedBed createdAt")
    .lean();
  if (active) return active;

  return PGResidency.findOne({
    tenant: tenantId,
    pg: pgId,
    status: "rejected",
  })
    .sort({ rejectedAt: -1 })
    .select("status roomType preferredMoveInDate monthlyRent depositAmount ownerNote rejectedAt createdAt")
    .lean();
}

export async function findAllRequestsByPg(pgId) {
  return PGResidency.find({ pg: pgId, status: { $in: ["pending", "approved", "rejected", "active"] } })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("tenant", "fullName profilePic phone email")
    .lean();
}

export async function findAllRequestsByOwner(ownerId) {
  const ownerPgs = await PropertyPost.find({
    author: ownerId,
    postType: "PG_HOSTEL",
    isDeleted: { $ne: true },
  }).select("_id").lean();

  const pgIds = ownerPgs.map((p) => p._id);
  if (!pgIds.length) return [];

  return PGResidency.find({ pg: { $in: pgIds }, status: { $in: ["pending", "approved", "rejected", "active"] } })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("tenant", "fullName profilePic phone email")
    .populate("pg", "title city locality")
    .lean();
}

export async function findTenantBookings(tenantId) {
  return PGResidency.find({ tenant: tenantId })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("pg", "title city locality mediaUrls postMeta author")
    .lean();
}
