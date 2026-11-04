import Story from "../../models/Story.model.js";
import User from "../../models/User.model.js";

export function createStory(data) {
  return Story.create(data);
}

export function findActiveStories(query, limit) {
  return Story.find(query)
    .populate("author", "fullName profilePic isVerified isOwnerVerified activeRole primaryRole")
    .populate("propertyId", "title price city listingType")
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();
}

export function markStoriesAsViewed(storyIds, userId) {
  return Story.updateMany(
    { _id: { $in: storyIds }, viewedBy: { $ne: userId } },
    {
      $push: { viewedBy: userId },
      $inc: { viewCount: 1 },
    }
  );
}

export function findUserActiveStories(userId) {
  return Story.find({
    author: userId,
    isActive: true,
    feedExpiresAt: { $gt: new Date() },
  })
    .populate("author", "fullName profilePic isVerified isOwnerVerified activeRole primaryRole")
    .populate("propertyId", "title price city listingType")
    .sort({ createdAt: -1 })
    .lean();
}

export function findAllUserStories(userId) {
  return Story.find({ author: userId })
    .populate("propertyId", "title price city listingType")
    .sort({ createdAt: -1 })
    .lean();
}

export function findStoryById(storyId) {
  return Story.findById(storyId);
}

export function findStoryByIdWithLikes(storyId) {
  return Story.findById(storyId).populate("likedBy", "fullName profilePic city isOwnerVerified").lean();
}

export function findStoryByIdWithViewers(storyId) {
  return Story.findById(storyId).populate("viewedBy", "fullName profilePic city isOwnerVerified");
}

export function findStoryByAuthor(storyId, userId) {
  return Story.findOne({ _id: storyId, author: userId }).lean();
}

export function deleteStoryById(storyId) {
  return Story.findByIdAndDelete(storyId);
}

export function findExpiredStories(limit) {
  return Story.find({ expiresAt: { $lte: new Date() } })
    .select("mediaUrl")
    .limit(limit)
    .lean();
}

export function deleteStoriesByIds(ids) {
  return Story.deleteMany({ _id: { $in: ids } });
}

export function findUserById(userId) {
  return User.findById(userId).select("friends").lean();
}
