import SavedSearch from "../../models/SavedSearch.model.js";

export async function listForUser(userId) {
  return SavedSearch.find({ user: userId }).sort({ createdAt: -1 }).lean();
}

export async function countForUser(userId) {
  return SavedSearch.countDocuments({ user: userId });
}

export async function getByKey(userId, filterKey) {
  return SavedSearch.findOne({ user: userId, filterKey }).lean();
}

export async function upsert(userId, filters, filterKey, label) {
  return SavedSearch.findOneAndUpdate(
    { user: userId, filterKey },
    { $set: { filters, label: label || "", active: true } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function updateById(userId, id, patch) {
  return SavedSearch.findOneAndUpdate({ _id: id, user: userId }, { $set: patch }, { new: true }).lean();
}

export async function removeById(userId, id) {
  return SavedSearch.deleteOne({ _id: id, user: userId });
}

// Candidate searches for a newly published post: active, and either
// city-agnostic or city-matching (case-insensitive). The finer filters are
// applied in JS by the service — the candidate set per city is small.
export async function candidatesForCity(city) {
  const cityClause = city
    ? { $or: [{ "filters.city": "" }, { "filters.city": new RegExp(`^${escapeRegex(city)}$`, "i") }] }
    : { "filters.city": "" };
  return SavedSearch.find({ active: true, ...cityClause }).lean();
}

export async function markMatched(ids, at) {
  if (!ids.length) return;
  await SavedSearch.updateMany(
    { _id: { $in: ids } },
    { $set: { lastNotifiedAt: at, lastMatchAt: at }, $inc: { matchCount: 1 } }
  );
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
