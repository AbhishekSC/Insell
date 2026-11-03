import { logger } from "../../utils/logger.js";
import commentAnalysisService from "../../services/CommentAnalysisService.js";
import PersonalizationService from "../../services/PersonalizationService.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import * as commentRepository from "./comment.repository.js";

export async function createComment({ postId, content, parentCommentId, userId, userFullName }) {
  const post = await commentRepository.findPostByIdWithAuthor(postId);
  if (!post || post.isDeleted) {
    return { error: { status: 404, message: "Post not found" } };
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
    const parentComment = await commentRepository.findCommentById(parentCommentId);
    if (!parentComment) {
      return { error: { status: 404, message: "Parent comment not found" } };
    }
    commentData.parentComment = parentCommentId;

    // Track comment reply for personalization
    await PersonalizationService.trackCommentEngagement(userId, parentCommentId, 'reply', postId);
  }

  const comment = await commentRepository.createComment(commentData);

  // Increment comment count on post
  await commentRepository.incrementPostCommentCount(postId);

  // Update user comment analytics
  await updateUserCommentAnalytics(userId, analytics, content.trim());

  // Create notification for post author (if not self-comment)
  if (String(post.author._id) !== String(userId)) {
    await NotificationService.send({
      recipientId: post.author._id,
      actorId: userId,
      type: "comment",
      title: `${userFullName} commented on your property: ${post.title}`,
      message: `${userFullName} commented on your property: ${post.title}`,
      pushBody: content.trim(),
      data: { propertyPost: post._id, actualMessage: content.trim() },
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    });
    logger.info("Comment notification sent for post:", post._id);
  }

  // Populate author details
  const populatedComment = await commentRepository.findPopulatedCommentById(comment._id);

  return { data: populatedComment };
}

/**
 * Update user comment analytics based on new comment
 */
async function updateUserCommentAnalytics(userId, analytics, content) {
  try {
    const user = await commentRepository.findUserById(userId);
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

export async function getPostComments({ postId, page, limit }) {
  const skip = (page - 1) * limit;

  const post = await commentRepository.findPostById(postId);
  if (!post || post.isDeleted) {
    return { error: { status: 404, message: "Post not found" } };
  }

  const comments = await commentRepository.findTopLevelComments(postId, skip, limit);

  // Fetch reply counts for each comment
  const commentIds = comments.map(c => c._id);
  const replyCounts = await commentRepository.aggregateReplyCounts(commentIds);

  const replyCountMap = {};
  replyCounts.forEach(({ _id, count }) => {
    replyCountMap[_id.toString()] = count;
  });

  // Add reply counts to comments
  const commentsWithReplyCount = comments.map(comment => ({
    ...comment,
    repliesCount: replyCountMap[comment._id.toString()] || 0,
  }));

  const total = await commentRepository.countTopLevelComments(postId);

  return {
    data: {
      comments: commentsWithReplyCount,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    },
  };
}

export async function deleteComment({ commentId, userId }) {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    return { error: { status: 404, message: "Comment not found" } };
  }

  if (String(comment.author) !== String(userId)) {
    return { error: { status: 403, message: "You can only delete your own comments" } };
  }

  comment.isDeleted = true;
  await comment.save();

  // Decrement comment count on post
  await commentRepository.decrementPostCommentCount(comment.post);

  return { success: true };
}

export async function likeComment({ commentId, userId }) {
  const comment = await commentRepository.findCommentById(commentId);
  if (!comment) {
    return { error: { status: 404, message: "Comment not found" } };
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

  return {
    data: {
      liked: !hasLiked,
      likesCount: comment.likesCount,
    },
  };
}

export async function getCommentReplies({ commentId, page, limit }) {
  const skip = (page - 1) * limit;

  const parentComment = await commentRepository.findCommentById(commentId);
  if (!parentComment) {
    return { error: { status: 404, message: "Comment not found" } };
  }

  const replies = await commentRepository.findReplies(commentId, skip, limit);

  // Add reply counts for each reply
  const replyIds = replies.map(r => r._id);
  const replyCounts = await commentRepository.aggregateReplyCounts(replyIds);

  const replyCountMap = {};
  replyCounts.forEach(rc => {
    replyCountMap[rc._id.toString()] = rc.count;
  });

  const repliesWithCounts = replies.map(reply => ({
    ...reply,
    repliesCount: replyCountMap[reply._id.toString()] || 0,
  }));

  const total = await commentRepository.countReplies(commentId);

  return {
    data: {
      replies: repliesWithCounts,
      pagination: {
        page,
        totalPages: Math.ceil(total / limit),
        total,
      },
    },
  };
}

export async function trackReplyView({ commentId, postId, userId }) {
  // Track view replies engagement for personalization
  await PersonalizationService.trackCommentEngagement(userId, commentId, 'view_replies', postId);
}
