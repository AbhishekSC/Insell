import Comment from "../../models/Comment.model.js";
import PropertyPost from "../../models/PropertyPost.model.js";
import User from "../../models/User.model.js";

export async function findPostByIdWithAuthor(postId) {
  return PropertyPost.findById(postId).populate("author", "fullName").lean();
}

export async function findCommentById(commentId) {
  return Comment.findById(commentId);
}

export async function createComment(commentData) {
  return Comment.create(commentData);
}

export async function incrementPostCommentCount(postId) {
  return PropertyPost.findByIdAndUpdate(postId, {
    $inc: { commentCount: 1 },
  });
}

export async function decrementPostCommentCount(postId) {
  return PropertyPost.findByIdAndUpdate(postId, {
    $inc: { commentCount: -1 },
  });
}

export async function findPopulatedCommentById(commentId) {
  return Comment.findById(commentId)
    .populate("author", "fullName profilePic activeRole primaryRole isOwnerVerified")
    .lean();
}

export async function findPostById(postId) {
  return PropertyPost.findById(postId).lean();
}

export async function findTopLevelComments(postId, skip, limit) {
  return Comment.find({ post: postId, parentComment: null, isDeleted: false })
    .populate("author", "fullName profilePic activeRole primaryRole isOwnerVerified")
    .populate({
      path: "parentComment",
      select: "_id",
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function aggregateReplyCounts(commentIds) {
  return Comment.aggregate([
    { $match: { parentComment: { $in: commentIds }, isDeleted: false } },
    { $group: { _id: "$parentComment", count: { $sum: 1 } } },
  ]);
}

export async function countTopLevelComments(postId) {
  return Comment.countDocuments({ post: postId, parentComment: null, isDeleted: false });
}

export async function findReplies(commentId, skip, limit) {
  return Comment.find({ parentComment: commentId, isDeleted: false })
    .populate("author", "fullName profilePic activeRole primaryRole isOwnerVerified")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

export async function countReplies(commentId) {
  return Comment.countDocuments({ parentComment: commentId, isDeleted: false });
}

export async function findUserById(userId) {
  return User.findById(userId);
}
