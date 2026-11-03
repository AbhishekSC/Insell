import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import * as service from "./admin.service.js";

function handleServiceError(res, result) {
  if (result?.error) {
    return sendErrorResponse(res, result.error.status, result.error.message);
  }
  return null;
}

function paginationWithPages(pagination) {
  return {
    ...pagination,
    totalPages: Math.max(1, Math.ceil(pagination.total / pagination.limit)),
  };
}

export const getAdminUsers = async (req, res) => {
  try {
    const { users, pagination } = await service.listUsers(req.query);
    return sendSuccessResponse(res, 200, "Users fetched successfully", {
      users,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching admin user list:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const toggleUserBlock = async (req, res) => {
  try {
    const result = await service.toggleUserBlock({
      targetUserId: req.params.id,
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    const { user } = result;
    return sendSuccessResponse(res, 200, `User ${user.isBlocked ? "blocked" : "unblocked"} successfully`, {
      userId: user._id,
      isBlocked: user.isBlocked,
      blockedAt: user.blockedAt,
    });
  } catch (error) {
    logger.error("Error toggling user block status:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getAdminPosts = async (req, res) => {
  try {
    const { posts, pagination } = await service.listPosts(req.query);
    return sendSuccessResponse(res, 200, "Posts fetched successfully", {
      posts,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching admin post list:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const blockPost = async (req, res) => {
  try {
    const result = await service.blockPost({
      postId: req.params.id,
      adminId: req.user._id,
      reasonCode: req.body?.reasonCode,
      note: req.body?.note,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    const { post } = result;
    return sendSuccessResponse(res, 200, "Post blocked successfully", {
      postId: post._id,
      isBlocked: post.isBlocked,
      blockedAt: post.blockedAt,
      blockReasonCode: post.blockReasonCode,
      blockNote: post.blockNote,
    });
  } catch (error) {
    logger.error("Error blocking post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const unblockPost = async (req, res) => {
  try {
    const result = await service.unblockPost({
      postId: req.params.id,
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    const { post } = result;
    return sendSuccessResponse(res, 200, "Post unblocked successfully", {
      postId: post._id,
      isBlocked: post.isBlocked,
    });
  } catch (error) {
    logger.error("Error unblocking post:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getAdminReports = async (req, res) => {
  try {
    const { reports, pagination } = await service.listReports(req.query);
    return sendSuccessResponse(res, 200, "Reports fetched successfully", {
      reports,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching admin reports:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getAdminReportDetail = async (req, res) => {
  try {
    const result = await service.getReportDetail(req.params.postId);
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 200, "Report detail fetched successfully", {
      post: result.post,
      reports: result.reports,
    });
  } catch (error) {
    logger.error("Error fetching report detail:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const dismissPostReports = async (req, res) => {
  try {
    const result = await service.dismissPostReports({
      postId: req.params.postId,
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 200, "Reports dismissed successfully");
  } catch (error) {
    logger.error("Error dismissing reports:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getAdminFeedback = async (req, res) => {
  try {
    const { items, pagination } = await service.listFeedback(req.query);
    return sendSuccessResponse(res, 200, "Feedback fetched successfully", {
      items,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching admin feedback:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const resolveFeedback = async (req, res) => {
  try {
    const result = await service.resolveFeedback({
      id: req.params.id,
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 200, "Feedback marked resolved", { feedback: result.feedback });
  } catch (error) {
    logger.error("Error resolving feedback:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const uploadAnnouncementImageController = async (req, res) => {
  try {
    if (!req.file) {
      return sendErrorResponse(res, 400, "No image uploaded");
    }
    return sendSuccessResponse(res, 200, "Image uploaded successfully", { url: req.file.path });
  } catch (error) {
    logger.error("Error uploading announcement image:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const result = await service.createAnnouncement({
      message: String(req.body?.message || "").trim(),
      role: String(req.body?.role || "").trim(),
      city: String(req.body?.city || "").trim(),
      verifiedOnly: Boolean(req.body?.verifiedOnly),
      image: String(req.body?.image || "").trim(),
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 201, "Announcement sent successfully", { announcement: result.announcement });
  } catch (error) {
    logger.error("Error creating announcement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getAnnouncements = async (req, res) => {
  try {
    const { announcements, pagination } = await service.listAnnouncements(req.query);
    return sendSuccessResponse(res, 200, "Announcements fetched successfully", {
      announcements,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching announcements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const getLiveUsersCount = async (req, res) => {
  try {
    const count = await service.getLiveUsersCount();
    return sendSuccessResponse(res, 200, "Live users count fetched successfully", { count });
  } catch (error) {
    logger.error("Error fetching live users count:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

export const adminCreditCoins = async (req, res) => {
  try {
    const result = await service.adminCreditCoins({
      userId: req.params.id,
      amount: req.body.amount,
      reason: req.body.reason,
      adminId: req.user._id,
      adminEmail: req.user.email,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 200, `${result.coinAmount} coins credited to ${result.fullName}`, {
      userId: result.userId,
      coinsGranted: result.coinAmount,
      newBalance: result.wallet.balance,
    });
  } catch (error) {
    logger.error("Error crediting coins:", error);
    return sendErrorResponse(res, 500, "Failed to credit coins");
  }
};

export const adminGetUserWallet = async (req, res) => {
  try {
    const result = await service.getAdminUserWallet(req.params.id);
    const err = handleServiceError(res, result);
    if (err) return err;

    const { wallet } = result;
    return sendSuccessResponse(res, 200, "Wallet fetched", {
      balance: wallet.balance,
      lifetimeEarned: wallet.lifetimeEarned,
      lifetimeSpent: wallet.lifetimeSpent,
    });
  } catch (error) {
    logger.error("Error fetching user wallet:", error);
    return sendErrorResponse(res, 500, "Failed to fetch wallet");
  }
};

export const adminGetCoinHistory = async (req, res) => {
  try {
    const { transactions, totalCoinsGranted, pagination } = await service.getCoinHistory(req.query);
    return sendSuccessResponse(res, 200, "Coin grant history fetched", {
      transactions,
      totalCoinsGranted,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching coin history:", error);
    return sendErrorResponse(res, 500, "Failed to fetch coin history");
  }
};

export const getAdminPropertyVerifications = async (req, res) => {
  try {
    const { posts, counts, pagination } = await service.listPropertyVerifications(req.query);
    return sendSuccessResponse(res, 200, "Property verifications fetched", {
      posts,
      counts,
      pagination: paginationWithPages(pagination),
    });
  } catch (error) {
    logger.error("Error fetching property verifications:", error);
    return sendErrorResponse(res, 500, "Failed to fetch property verifications");
  }
};

export const reviewPropertyVerification = async (req, res) => {
  try {
    const result = await service.reviewPropertyVerification({
      postId: req.params.id,
      status: req.body?.status,
      rejectionReason: req.body?.rejectionReason,
      verificationNote: req.body?.verificationNote,
      adminId: req.user._id,
    });
    const err = handleServiceError(res, result);
    if (err) return err;

    return sendSuccessResponse(res, 200, `Property bill marked as ${req.body.status}`, { post: result.post });
  } catch (error) {
    logger.error("Error reviewing property verification:", error);
    return sendErrorResponse(res, 500, "Failed to review property verification");
  }
};

export const downloadPropertyBill = async (req, res) => {
  try {
    const result = await service.getPropertyBillDownloadUrl(req.params.id);
    const err = handleServiceError(res, result);
    if (err) return err;

    return res.redirect(result.redirectUrl);
  } catch (error) {
    logger.error("Error generating property bill download URL:", error);
    return sendErrorResponse(res, 500, "Failed to download bill");
  }
};
