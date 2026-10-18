import PropertyPost from "../models/PropertyPost.model.js";
import BaseRepository from "./BaseRepository.js";

export default class LocalityTrendsRepository extends BaseRepository {
  constructor() {
    super(PropertyPost);
  }

  async aggregateMonthlyTrends({ city, locality, intent, months = 12 }) {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const matchStage = {
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      price: { $gt: 0 },
      areaSqft: { $gt: 0 },
      city: { $regex: new RegExp(`^${city}$`, "i") },
      createdAt: { $gte: since },
    };

    if (locality) {
      matchStage.locality = { $regex: new RegExp(`^${locality}$`, "i") };
    }

    if (intent === "rent") {
      matchStage.listingType = "Rent";
    } else if (intent === "buy") {
      matchStage.listingType = { $ne: "Rent" };
    }

    return this.model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          avgPrice: { $avg: "$price" },
          avgPsf: { $avg: { $divide: ["$price", "$areaSqft"] } },
          minPsf: { $min: { $divide: ["$price", "$areaSqft"] } },
          maxPsf: { $max: { $divide: ["$price", "$areaSqft"] } },
          listings: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);
  }

  async getTopLocalities({ city, intent, limit = 10 }) {
    const since = new Date();
    since.setMonth(since.getMonth() - 6);

    const matchStage = {
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      price: { $gt: 0 },
      areaSqft: { $gt: 0 },
      city: { $regex: new RegExp(`^${city}$`, "i") },
      locality: { $nin: [null, ""] },
      createdAt: { $gte: since },
    };

    if (intent === "rent") {
      matchStage.listingType = "Rent";
    } else if (intent === "buy") {
      matchStage.listingType = { $ne: "Rent" };
    }

    return this.model.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$locality",
          avgPsf: { $avg: { $divide: ["$price", "$areaSqft"] } },
          avgPrice: { $avg: "$price" },
          listings: { $sum: 1 },
        },
      },
      { $match: { listings: { $gte: 3 } } },
      { $sort: { listings: -1 } },
      { $limit: limit },
    ]);
  }

  async getLocalitySummary({ city, locality, intent }) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseMatch = {
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      price: { $gt: 0 },
      areaSqft: { $gt: 0 },
      city: { $regex: new RegExp(`^${city}$`, "i") },
      locality: { $regex: new RegExp(`^${locality}$`, "i") },
    };

    if (intent === "rent") {
      baseMatch.listingType = "Rent";
    } else if (intent === "buy") {
      baseMatch.listingType = { $ne: "Rent" };
    }

    const [recent, older] = await Promise.all([
      this.model.aggregate([
        { $match: { ...baseMatch, createdAt: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: null,
            avgPsf: { $avg: { $divide: ["$price", "$areaSqft"] } },
            avgPrice: { $avg: "$price" },
            listings: { $sum: 1 },
          },
        },
      ]),
      this.model.aggregate([
        {
          $match: {
            ...baseMatch,
            createdAt: { $gte: twelveMonthsAgo, $lt: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: null,
            avgPsf: { $avg: { $divide: ["$price", "$areaSqft"] } },
            avgPrice: { $avg: "$price" },
            listings: { $sum: 1 },
          },
        },
      ]),
    ]);

    return { recent: recent[0] || null, older: older[0] || null };
  }
}
