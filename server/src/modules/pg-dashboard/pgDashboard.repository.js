import PropertyPost from "../../models/PropertyPost.model.js";
import PGResidency from "../../models/PGResidency.model.js";
import PGBill from "../../models/PGBill.model.js";
import IssueReport from "../../models/IssueReport.model.js";
import PGReview from "../../models/PGReview.model.js";
import MealRating from "../../models/MealRating.model.js";

export async function findOwnerPgs(ownerId) {
  return PropertyPost.find({ author: ownerId, postType: "PG_HOSTEL", isDeleted: { $ne: true } })
    .select("_id title city locality postMeta.pgHostel")
    .lean();
}

export async function getVacancySummary(pgId) {
  const pg = await PropertyPost.findById(pgId)
    .select("postMeta.pgHostel.totalBeds postMeta.pgHostel.availableBeds postMeta.pgHostel.residentCount")
    .lean();
  if (!pg) return null;
  const meta = pg.postMeta?.pgHostel || {};
  return {
    totalBeds: meta.totalBeds || 0,
    availableBeds: meta.availableBeds || 0,
    occupiedBeds: (meta.totalBeds || 0) - (meta.availableBeds || 0),
    activeResidents: meta.residentCount || 0,
  };
}

export async function getRentCollectionSummary(pgId, month, year) {
  const bills = await PGBill.find({ pg: pgId, month, year })
    .select("totalAmount paid tenant")
    .populate("tenant", "fullName")
    .lean();

  let totalBilled = 0;
  let totalCollected = 0;
  const unpaid = [];

  for (const bill of bills) {
    totalBilled += bill.totalAmount || 0;
    if (bill.paid) {
      totalCollected += bill.totalAmount || 0;
    } else {
      unpaid.push({ tenant: bill.tenant, amount: bill.totalAmount });
    }
  }

  return { totalBilled, totalCollected, pendingAmount: totalBilled - totalCollected, unpaid, billCount: bills.length };
}

export async function getOpenComplaints(pgId) {
  return IssueReport.find({ pg: pgId, status: { $in: ["open", "acknowledged", "in_progress"] } })
    .select("title category status priority createdAt")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();
}

export async function getComplaintStats(pgId) {
  const result = await IssueReport.aggregate([
    { $match: { pg: pgId } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
      },
    },
  ]);

  const stats = { open: 0, acknowledged: 0, in_progress: 0, resolved: 0, closed: 0, total: 0 };
  for (const r of result) {
    stats[r._id] = r.count;
    stats.total += r.count;
  }
  return stats;
}

export async function getRatingSummary(pgId) {
  return PGReview.aggregate([
    { $match: { pg: pgId } },
    {
      $group: {
        _id: null,
        avgOverall: { $avg: "$overallRating" },
        avgFood: { $avg: "$categoryRatings.food" },
        avgCleanliness: { $avg: "$categoryRatings.cleanliness" },
        avgWifi: { $avg: "$categoryRatings.wifi" },
        avgWater: { $avg: "$categoryRatings.water" },
        avgSafety: { $avg: "$categoryRatings.safety" },
        avgLandlord: { $avg: "$categoryRatings.landlord" },
        avgValue: { $avg: "$categoryRatings.value_for_money" },
        avgLocation: { $avg: "$categoryRatings.location" },
        reviewCount: { $sum: 1 },
      },
    },
  ]).then((r) => r[0] || null);
}

export async function getFoodRatingSummary(pgId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return MealRating.aggregate([
    { $match: { pg: pgId, date: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: "$mealType",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
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

export async function getRecentMoveActivity(pgId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [moveIns, moveOuts] = await Promise.all([
    PGResidency.countDocuments({ pg: pgId, moveInDate: { $gte: thirtyDaysAgo } }),
    PGResidency.countDocuments({ pg: pgId, moveOutDate: { $gte: thirtyDaysAgo }, status: "moved_out" }),
  ]);

  return { moveIns, moveOuts };
}
