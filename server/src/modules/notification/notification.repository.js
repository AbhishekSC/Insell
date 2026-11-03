import Notification from "../../models/Notification.model.js";
import Review from "../../models/Review.model.js";

export async function createNotification(data) {
  return Notification.create(data);
}

export async function findNotifications(filter) {
  return Notification.find(filter)
    .populate("actor", "fullName profilePic isVerified isOwnerVerified activeRole primaryRole")
    .populate("propertyPost", "title price city listingType mediaUrls")
    // Offer status, not just the id — an "offer_received"/"offer_countered"
    // notification's `type` never changes once you act on it, so without
    // this the Accept/Decline buttons would stay up forever on the same
    // notification even after the offer is already closed, and a second
    // click would just 400 ("already closed") looking like a broken button.
    .populate("offer", "status")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
}

export async function findReviewsByOfferIds(offerIds, userId) {
  return Review.find({ offer: { $in: offerIds }, reviewer: userId }).select("offer").lean();
}

export async function countUnreadNotifications(userId, extraFilter = {}) {
  return Notification.countDocuments({ recipient: userId, read: false, ...extraFilter });
}

export async function countUnreadMessageRequests(userId) {
  return Notification.countDocuments({ recipient: userId, read: false, type: "message_request" });
}

export async function countPendingFriendRequests(userId) {
  const FriendRequest = (await import("../../models/FriendRequest.model.js")).default;
  return FriendRequest.countDocuments({ receiver: userId, status: "pending" });
}

export async function markNotificationAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { read: true },
    { new: true }
  );
}

export async function markAllNotificationsAsRead(userId) {
  // circle_invite is excluded: it's the only notification type that also
  // doubles as the data source for the Communities tab's "You've been
  // invited" Join/Decline banner (filtered on read: false there). Marking
  // it read here — just from visiting Activity/Chat/Connections — would
  // silently make a still-pending invite disappear from that banner with
  // no way left to act on it, even though the user is still sitting in
  // the community's pendingInvites. It gets marked read on its own once
  // the user actually responds via respondToCommunityInvite.
  return Notification.updateMany(
    { recipient: userId, read: false, type: { $ne: "circle_invite" } },
    { read: true }
  );
}

export async function handleMessageRequestUpdate(notificationId, userId, action) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId, type: "message_request" },
    { requestStatus: action, read: true },
    { new: true }
  );
}

export async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({
    _id: notificationId,
    recipient: userId,
  });
}
