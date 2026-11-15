import MealRating from "../../models/MealRating.model.js";

export async function create(data) {
  return MealRating.create(data);
}

export async function findByPgAndDate(pgId, date) {
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  return MealRating.find({ pg: pgId, date: { $gte: dayStart, $lte: dayEnd } })
    .populate("rater", "fullName profilePic")
    .sort({ mealType: 1 })
    .lean();
}

export async function findByPgMonthly(pgId, month, year) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  return MealRating.aggregate([
    { $match: { pg: pgId, date: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: "$mealType",
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
  ]);
}

export async function getOverallFoodScore(pgId, daysBack = 30) {
  const since = new Date();
  since.setDate(since.getDate() - daysBack);

  const [result] = await MealRating.aggregate([
    { $match: { pg: pgId, date: { $gte: since } } },
    { $group: { _id: null, avgRating: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  return result || { avgRating: 0, count: 0 };
}

export async function getFoodTrend(pgId, months = 3) {
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  return MealRating.aggregate([
    { $match: { pg: pgId, date: { $gte: since } } },
    {
      $group: {
        _id: { month: { $month: "$date" }, year: { $year: "$date" } },
        avgRating: { $avg: "$rating" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);
}
