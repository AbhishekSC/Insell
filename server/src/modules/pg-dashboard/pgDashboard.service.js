import * as repo from "./pgDashboard.repository.js";

export async function getOwnerDashboard(ownerId, { pgId, month, year } = {}) {
  const pgs = await repo.findOwnerPgs(ownerId);
  if (!pgs.length) return { dashboards: [], empty: true };

  const now = new Date();
  const targetMonth = month || now.getMonth() + 1;
  const targetYear = year || now.getFullYear();

  if (pgId) {
    const pg = pgs.find((p) => String(p._id) === String(pgId));
    if (!pg) return { error: { status: 403, message: "You do not own this PG" } };
    const dashboard = await buildPgDashboard(pgId, targetMonth, targetYear);
    return { dashboard: { pg, ...dashboard } };
  }

  const dashboards = await Promise.all(
    pgs.slice(0, 10).map(async (pg) => {
      const data = await buildPgDashboard(pg._id, targetMonth, targetYear);
      return { pg, ...data };
    })
  );

  return { dashboards };
}

async function buildPgDashboard(pgId, month, year) {
  const [vacancy, rent, complaintStats, openComplaints, ratings, foodRatings, pendingDeposits, moveActivity] =
    await Promise.all([
      repo.getVacancySummary(pgId),
      repo.getRentCollectionSummary(pgId, month, year),
      repo.getComplaintStats(pgId),
      repo.getOpenComplaints(pgId),
      repo.getRatingSummary(pgId),
      repo.getFoodRatingSummary(pgId),
      repo.getPendingDeposits(pgId),
      repo.getRecentMoveActivity(pgId),
    ]);

  return {
    vacancy,
    rentCollection: rent,
    complaints: { stats: complaintStats, openIssues: openComplaints },
    ratings,
    foodRatings,
    pendingDeposits,
    moveActivity,
    month,
    year,
  };
}

export async function getPgOverview(ownerId) {
  const pgs = await repo.findOwnerPgs(ownerId);
  if (!pgs.length) return { overview: [] };

  const overview = pgs.map((pg) => {
    const meta = pg.postMeta?.pgHostel || {};
    return {
      _id: pg._id,
      title: pg.title,
      city: pg.city,
      locality: pg.locality,
      totalBeds: meta.totalBeds || 0,
      availableBeds: meta.availableBeds || 0,
      avgRating: meta.avgRatings?.overall || 0,
      reviewCount: meta.reviewCount || 0,
      residentCount: meta.residentCount || 0,
    };
  });

  return { overview };
}
