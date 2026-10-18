import BaseService from "./BaseService.js";
import LocalityTrendsRepository from "../repositories/LocalityTrendsRepository.js";

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default class LocalityTrendsService extends BaseService {
  constructor() {
    super();
    this.repo = new LocalityTrendsRepository();
  }

  async getMonthlyTrends({ city, locality, intent = "buy", months = 12 }) {
    const raw = await this.repo.aggregateMonthlyTrends({ city, locality, intent, months });

    const monthlyData = raw.map((r) => ({
      month: `${MONTH_NAMES[r._id.month]} ${r._id.year}`,
      year: r._id.year,
      monthNum: r._id.month,
      avgPrice: Math.round(r.avgPrice),
      avgPsf: Math.round(r.avgPsf),
      minPsf: Math.round(r.minPsf),
      maxPsf: Math.round(r.maxPsf),
      listings: r.listings,
    }));

    let changePercent = null;
    if (monthlyData.length >= 2) {
      const first = monthlyData[0].avgPsf;
      const last = monthlyData[monthlyData.length - 1].avgPsf;
      if (first > 0) {
        changePercent = Number((((last - first) / first) * 100).toFixed(1));
      }
    }

    return {
      city,
      locality: locality || null,
      intent,
      monthlyData,
      changePercent,
      currentAvgPsf: monthlyData.length ? monthlyData[monthlyData.length - 1].avgPsf : null,
      totalListings: monthlyData.reduce((sum, m) => sum + m.listings, 0),
    };
  }

  async getLocalityOverview({ city, intent = "buy" }) {
    const [topLocalities, cityTrends] = await Promise.all([
      this.repo.getTopLocalities({ city, intent, limit: 15 }),
      this.repo.aggregateMonthlyTrends({ city, intent, months: 6 }),
    ]);

    const localities = topLocalities.map((l) => ({
      locality: l._id,
      avgPsf: Math.round(l.avgPsf),
      avgPrice: Math.round(l.avgPrice),
      listings: l.listings,
    }));

    const cityMonthly = cityTrends.map((r) => ({
      month: `${MONTH_NAMES[r._id.month]} ${r._id.year}`,
      avgPsf: Math.round(r.avgPsf),
      listings: r.listings,
    }));

    return { city, intent, localities, cityMonthly };
  }

  async getLocalityDetail({ city, locality, intent = "buy" }) {
    const [trends, summary] = await Promise.all([
      this.getMonthlyTrends({ city, locality, intent, months: 12 }),
      this.repo.getLocalitySummary({ city, locality, intent }),
    ]);

    let halfYearChange = null;
    if (summary.recent && summary.older && summary.older.avgPsf > 0) {
      halfYearChange = Number(
        (((summary.recent.avgPsf - summary.older.avgPsf) / summary.older.avgPsf) * 100).toFixed(1)
      );
    }

    return {
      ...trends,
      summary: {
        recentAvgPsf: summary.recent ? Math.round(summary.recent.avgPsf) : null,
        recentListings: summary.recent?.listings || 0,
        olderAvgPsf: summary.older ? Math.round(summary.older.avgPsf) : null,
        olderListings: summary.older?.listings || 0,
        halfYearChange,
      },
    };
  }
}
