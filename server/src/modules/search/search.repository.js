import PropertyPost from "../../models/PropertyPost.model.js";
import User from "../../models/User.model.js";

export async function aggregateLocationSuggestions(publishedMatch, searchRegex) {
  return PropertyPost.aggregate([
    { $match: { ...publishedMatch, $or: [{ city: searchRegex }, { location: searchRegex }] } },
    { $group: { _id: { $ifNull: ["$city", "$location"] }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
    { $project: { _id: 0, type: "location", value: "$_id", count: 1 } },
  ]);
}

export async function aggregateTypeSuggestions(publishedMatch, searchRegex) {
  return PropertyPost.aggregate([
    { $match: { ...publishedMatch, propertyType: searchRegex } },
    { $group: { _id: "$propertyType", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 3 },
    { $project: { _id: 0, type: "propertyType", value: "$_id", count: 1 } },
  ]);
}

export async function findAuthorSuggestions(searchRegex) {
  return User.find({ fullName: searchRegex, isBlocked: { $ne: true } })
    .select("fullName")
    .limit(3)
    .lean()
    .then((users) => users.map((u) => ({ type: "author", value: u.fullName, authorId: String(u._id), count: 1 })));
}

export async function findUserById(userId) {
  return User.findById(userId);
}

export async function findUserSearchHistory(userId) {
  return User.findById(userId).select("searchHistory").lean();
}

export async function clearUserSearchHistory(userId) {
  return User.findByIdAndUpdate(userId, { searchHistory: [] });
}
