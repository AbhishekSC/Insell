import mongoose from "mongoose";
import Notification from "../../models/Notification.model.js";
import User from "../../models/User.model.js";

const DIGEST_TYPES = ["saved_search_match", "price_drop"];

// Groups the last N days' saved-search-match / price-drop notifications by
// recipient. Deliberately reads the Notification collection that every
// individual real-time alert already writes to, rather than re-running the
// match logic — a user who missed those in-app pings gets a recap of what
// already happened, not a second independent computation of "what's new".
export async function recentDigestCountsByRecipient(sinceDate) {
  return Notification.aggregate([
    { $match: { type: { $in: DIGEST_TYPES }, createdAt: { $gte: sinceDate } } },
    {
      $group: {
        _id: { recipient: "$recipient", type: "$type" },
        count: { $sum: 1 },
        samplePost: { $first: "$propertyPost" },
      },
    },
    {
      $group: {
        _id: "$_id.recipient",
        byType: { $push: { type: "$_id.type", count: "$count", samplePost: "$samplePost" } },
        total: { $sum: "$count" },
      },
    },
  ]);
}

// Recipients who have an email, haven't opted out, and aren't blocked/deleted.
export async function eligibleRecipients(ids) {
  return User.find({
    _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(String(id))) },
    emailDigestOptOut: { $ne: true },
    isBlocked: { $ne: true },
  })
    .select("email fullName")
    .lean();
}
