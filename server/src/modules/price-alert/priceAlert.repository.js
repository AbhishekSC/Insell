import PriceAlert from "../../models/PriceAlert.model.js";

export async function getAlert(userId, postId) {
  return PriceAlert.findOne({ user: userId, post: postId }).lean();
}

export async function upsertAlert(userId, postId, targetPrice) {
  // Setting/changing a target is a fresh commitment — clear the throttle so
  // the next qualifying drop notifies.
  return PriceAlert.findOneAndUpdate(
    { user: userId, post: postId },
    {
      $set: {
        targetPrice,
        direction: "below",
        active: true,
        lastNotifiedAt: null,
        lastNotifiedPrice: null,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
}

export async function deactivateAlert(userId, postId) {
  return PriceAlert.updateOne({ user: userId, post: postId }, { $set: { active: false } });
}

export async function listActiveForUser(userId) {
  return PriceAlert.find({ user: userId, active: true })
    .sort({ updatedAt: -1 })
    .populate("post", "title price city locality mediaUrls status")
    .lean();
}

export async function countActiveForPost(postId) {
  return PriceAlert.countDocuments({ post: postId, active: true });
}

export async function activeUserIdsForPost(postId) {
  return PriceAlert.find({ post: postId, active: true }).distinct("user");
}

// Alerts that a drop to `price` should fire: target met, and either never
// notified or the price has fallen further since we last did.
export async function findTriggered(postId, price) {
  return PriceAlert.find({
    post: postId,
    active: true,
    targetPrice: { $gte: price },
    $or: [{ lastNotifiedPrice: null }, { lastNotifiedPrice: { $gt: price } }],
  }).lean();
}

export async function markNotified(ids, price) {
  if (!ids.length) return;
  await PriceAlert.updateMany(
    { _id: { $in: ids } },
    { $set: { lastNotifiedAt: new Date(), lastNotifiedPrice: price } }
  );
}

export async function deleteForPost(postId) {
  await PriceAlert.deleteMany({ post: postId });
}
