import Comment from "../models/Comment.model.js";
import PropertyPost from "../models/PropertyPost.model.js";
import Notification from "../models/Notification.model.js";
import User from "../models/User.model.js";
import { sendErrorResponse, sendSuccessResponse } from "../utils/responseHandler.js";
import { logger } from "../utils/logger.js";
import commentAnalysisService from "../services/CommentAnalysisService.js";
import PersonalizationService from "../services/PersonalizationService.js";

export async function createComment(req, res) {
  try {
    const { postId } = req.params;
    const { content, parentCommentId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    if (!content || content.trim().length === 0) {
      return sendErrorResponse(res, 400, "Comment content is required");
    }

    const post = await PropertyPost.findById(postId).populate("author", "fullName");
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    // Analyze comment content for personalization
    const analytics = commentAnalysisService.analyzeComment(content.trim());

    const commentData = {
      post: postId,
      author: userId,
      content: content.trim(),
      keywords: analytics.keywords,
      sentiment: analytics.sentiment,
      sentimentScore: analytics.sentimentScore,
      category: analytics.category,
      propertyMentions: analytics.propertyMentions,
      intent: analytics.intent,
    };

    if (parentCommentId) {
      const parentComment = await Comment.findById(parentCommentId);
      if (!parentComment) {
        return sendErrorResponse(res, 404, "Parent comment not found");
      }
      commentData.parentComment = parentCommentId;
      
      // Track comment reply for personalization
      await PersonalizationService.trackCommentEngagement(userId, parentCommentId, 'reply', postId);
    }

    const comment = await Comment.create(commentData);

    // Increment comment count on post
    await PropertyPost.findByIdAndUpdate(postId, {
      $inc: { commentCount: 1 },
    });

    // Update user comment analytics
    await updateUserCommentAnalytics(userId, analytics, content.trim());

    // Create notification for post author (if not self-comment)
    if (String(post.author._id) !== String(userId)) {
      console.log("Creating comment notification for recipient:", post.author._id, "from actor:", userId);
      const notification = await Notification.create({
        recipient: post.author._id,
        actor: userId,
        type: "comment",
        message: `${req.user.fullName} commented on your property: ${post.title}`,
        actualMessage: content.trim(),
        propertyPostId: post._id,
      });
      console.log("Comment notification created:", notification._id, "with actualMessage:", notification.actualMessage);
      logger.info("Comment notification created for post:", post._id);
    }

    // Populate author details
    const populatedComment = await Comment.findById(comment._id)
      .populate("author", "fullName profilePic activeRole primaryRole")
      .lean();

    return sendSuccessResponse(res, 201, "Comment created successfully", populatedComment);
  } catch (error) {
    logger.error("Error creating comment:", error);
    return sendErrorResponse(res, 500, "Failed to create comment");
  }
}

/**
 * Update user comment analytics based on new comment
 */
async function updateUserCommentAnalytics(userId, analytics, content) {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Initialize comment analytics if not exists
    if (!user.commentAnalytics) {
      user.commentAnalytics = {
        totalComments: 0,
        avgCommentLength: 0,
        commonKeywords: [],
        sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
        interestCategories: [],
        detectedIntents: [],
        propertyTypeInterests: [],
        lastCommentAt: null,
      };
    }

    // Update total comments and average length
    const commentLength = content.length;
    const totalComments = user.commentAnalytics.totalComments + 1;
    const currentAvgLength = user.commentAnalytics.avgCommentLength || 0;
    const newAvgLength = ((currentAvgLength * (totalComments - 1)) + commentLength) / totalComments;

    user.commentAnalytics.totalComments = totalComments;
    user.commentAnalytics.avgCommentLength = Math.round(newAvgLength);
    user.commentAnalytics.lastCommentAt = new Date();

    // Update sentiment distribution
    user.commentAnalytics.sentimentDistribution[analytics.sentiment]++;

    // Update common keywords (keep top 10)
    analytics.keywords.forEach(keyword => {
      const existingIndex = user.commentAnalytics.commonKeywords.indexOf(keyword);
      if (existingIndex === -1) {
        user.commentAnalytics.commonKeywords.push(keyword);
      }
    });
    // Keep only top 10 most common keywords
    user.commentAnalytics.commonKeywords = user.commentAnalytics.commonKeywords.slice(0, 10);

    // Update interest categories
    if (!user.commentAnalytics.interestCategories.includes(analytics.category)) {
      user.commentAnalytics.interestCategories.push(analytics.category);
    }

    // Update detected intents
    if (!user.commentAnalytics.detectedIntents.includes(analytics.intent)) {
      user.commentAnalytics.detectedIntents.push(analytics.intent);
    }

    // Update property type interests
    analytics.propertyMentions.forEach(mention => {
      const existingInterest = user.commentAnalytics.propertyTypeInterests.find(
        interest => interest.type === mention
      );
      if (existingInterest) {
        existingInterest.frequency++;
        existingInterest.lastMentioned = new Date();
      } else {
        user.commentAnalytics.propertyTypeInterests.push({
          type: mention,
          frequency: 1,
          lastMentioned: new Date(),
        });
      }
    });

    // Sort property interests by frequency and keep top 10
    user.commentAnalytics.propertyTypeInterests.sort((a, b) => b.frequency - a.frequency);
    user.commentAnalytics.propertyTypeInterests = user.commentAnalytics.propertyTypeInterests.slice(0, 10);

    await user.save();
    logger.info(`Updated comment analytics for user ${userId}`);
  } catch (error) {
    logger.error("Error updating user comment analytics:", error);
    // Don't fail the comment creation if analytics update fails
  }
}

export async function getPostComments(req, res) {
  try {
    const { postId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const post = await PropertyPost.findById(postId);
    if (!post || post.isDeleted) {
      return sendErrorResponse(res, 404, "Post not found");
    }

    const comments = await Comment.find({ post: postId, parentComment: null, isDeleted: false })
      .populate("author", "fullName profilePic activeRole primaryRole")
      .populate({
        path: "parentComment",
        select: "_id",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Fetch reply counts for each comment
    const commentIds = comments.map(c => c._id);
    const replyCounts = await Comment.aggregate([
      { $match: { parentComment: { $in: commentIds }, isDeleted: false } },
      { $group: { _id: "$parentComment", count: { $sum: 1 } } }
    ]);

    const replyCountMap = {};
    replyCounts.forEach(({ _id, count }) => {
      replyCountMap[_id.toString()] = count;
    });

    // Add reply counts to comments
    const commentsWithReplyCount = comments.map(comment => ({
      ...comment,
      repliesCount: replyCountMap[comment._id.toString()] || 0
    }));

    const total = await Comment.countDocuments({ post: postId, parentComment: null, isDeleted: false });

    return sendSuccessResponse(res, 200, "Comments fetched successfully", {
      comments: commentsWithReplyCount,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    logger.error("Error fetching comments:", error);
    return sendErrorResponse(res, 500, "Failed to fetch comments");
  }
}

export async function deleteComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return sendErrorResponse(res, 404, "Comment not found");
    }

    if (String(comment.author) !== String(userId)) {
      return sendErrorResponse(res, 403, "You can only delete your own comments");
    }

    comment.isDeleted = true;
    await comment.save();

    // Decrement comment count on post
    await PropertyPost.findByIdAndUpdate(comment.post, {
      $inc: { commentCount: -1 },
    });

    return sendSuccessResponse(res, 200, "Comment deleted successfully");
  } catch (error) {
    logger.error("Error deleting comment:", error);
    return sendErrorResponse(res, 500, "Failed to delete comment");
  }
}

export async function likeComment(req, res) {
  try {
    const { commentId } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return sendErrorResponse(res, 404, "Comment not found");
    }

    const userIdString = String(userId);
    const hasLiked = comment.likedBy.some((id) => String(id) === userIdString);

    if (hasLiked) {
      comment.likedBy = comment.likedBy.filter((id) => String(id) !== userIdString);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
    } else {
      comment.likedBy.push(userId);
      comment.likesCount += 1;
      
      // Track comment like for personalization
      await PersonalizationService.trackCommentEngagement(userId, commentId, 'like', comment.post);
    }

    await comment.save();

    return sendSuccessResponse(res, 200, "Comment like status updated", {
      liked: !hasLiked,
      likesCount: comment.likesCount,
    });
  } catch (error) {
    logger.error("Error toggling comment like:", error);
    return sendErrorResponse(res, 500, "Failed to toggle comment like");
  }
}

export async function getCommentReplies(req, res) {
  try {
    const { commentId } = req.params;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const parentComment = await Comment.findById(commentId);
    if (!parentComment) {
      return sendErrorResponse(res, 404, "Comment not found");
    }

    const replies = await Comment.find({ parentComment: commentId, isDeleted: false })
      .populate("author", "fullName profilePic activeRole primaryRole")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Add reply counts for each reply
    const replyIds = replies.map(r => r._id);
    const replyCounts = await Comment.aggregate([
      { $match: { parentComment: { $in: replyIds }, isDeleted: false } },
      { $group: { _id: "$parentComment", count: { $sum: 1 } } }
    ]);

    const replyCountMap = {};
    replyCounts.forEach(rc => {
      replyCountMap[rc._id.toString()] = rc.count;
    });

    const repliesWithCounts = replies.map(reply => ({
      ...reply,
      repliesCount: replyCountMap[reply._id.toString()] || 0
    }));

    const total = await Comment.countDocuments({ parentComment: commentId, isDeleted: false });

    return sendSuccessResponse(res, 200, "Replies fetched successfully", {
      replies: repliesWithCounts,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    logger.error("Error fetching comment replies:", error);
    return sendErrorResponse(res, 500, "Failed to fetch replies");
  }
}

export async function trackReplyView(req, res) {
  try {
    const { commentId } = req.params;
    const { postId } = req.body;
    const userId = req.user?._id;

    if (!userId) {
      return sendErrorResponse(res, 401, "Unauthorized");
    }

    // Track view replies engagement for personalization
    await PersonalizationService.trackCommentEngagement(userId, commentId, 'view_replies', postId);

    return sendSuccessResponse(res, 200, "Reply view tracked successfully");
  } catch (error) {
    logger.error("Error tracking reply view:", error);
    return sendErrorResponse(res, 500, "Failed to track reply view");
  }
}
