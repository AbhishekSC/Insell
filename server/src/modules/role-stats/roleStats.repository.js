import PropertyPost from "../../models/PropertyPost.model.js";
import User from "../../models/User.model.js";

export const findUserRole = (userId) => {
  return User.findById(userId).select("activeRole primaryRole").lean();
};

export const findUserSavedAndViewed = (userId) => {
  return User.findById(userId).select("savedPosts viewedPosts").lean();
};

export const findPublishedPostsByAuthor = (userId) => {
  return PropertyPost.find({
    author: userId,
    status: "PUBLISHED",
  }).select("viewCount createdAt").lean();
};

export const countPublishedPostsByAuthor = (userId) => {
  return PropertyPost.countDocuments({
    author: userId,
    status: "PUBLISHED",
  });
};

export const countPublishedPostsByAuthorSince = (userId, since) => {
  return PropertyPost.countDocuments({
    author: userId,
    status: "PUBLISHED",
    createdAt: { $gte: since },
  });
};

export const countPublishedPostsSince = (since) => {
  return PropertyPost.countDocuments({
    status: "PUBLISHED",
    createdAt: { $gte: since },
  });
};
