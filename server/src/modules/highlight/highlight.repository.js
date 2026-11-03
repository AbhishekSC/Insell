import Highlight from "../../models/Highlight.model.js";
import Story from "../../models/Story.model.js";
import User from "../../models/User.model.js";

export const findUserFriends = (userId) => {
  return User.findById(userId).select("friends").lean();
};

export const findStoryByIdAndAuthor = (storyId, userId) => {
  return Story.findOne({ _id: storyId, author: userId });
};

export const unsetStoryExpiry = (storyId) => {
  return Story.updateOne({ _id: storyId }, { $unset: { expiresAt: 1 } });
};

export const createHighlight = (data) => {
  return Highlight.create(data);
};

export const findHighlightByIdAndOwner = (id, owner) => {
  return Highlight.findOne({ _id: id, owner });
};

export const findHighlightByIdPopulated = (id) => {
  return Highlight.findById(id).populate({
    path: "stories",
    populate: [
      { path: "author", select: "fullName profilePic isVerified activeRole primaryRole" },
      { path: "propertyId", select: "title price city listingType" },
    ],
  });
};

export const findUserHighlights = (userId) => {
  return Highlight.find({ owner: userId, stories: { $ne: [] } })
    .select("title coverImage stories createdAt")
    .sort({ createdAt: -1 })
    .lean();
};

export const deleteHighlightByIdAndOwner = (id, owner) => {
  return Highlight.deleteOne({ _id: id, owner });
};
