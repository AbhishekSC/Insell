import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";
import {
  getActiveAdsForFeed,
  recordAdImpression,
  recordAdClick,
  dismissAd,
  getAdminAdsList,
  createAdminAd,
  updateAdminAd,
  deleteAdminAd,
  processUploadedMedia,
  createAdWithCoins,
  getUserCampaigns,
  toggleCampaignStatus,
  calculateAdScore,
  balanceAdFeed,
} from "./advertisement.service.js";
import { AD_COIN_PLANS } from "./advertisement.constants.js";

// ── Re-exports for backward compatibility ────────────────────────────
export { calculateAdScore, balanceAdFeed, AD_COIN_PLANS };

// ── Public: active feed ──────────────────────────────────────────────

export const getActiveAdvertisements = async (req, res) => {
  try {
    const result = await getActiveAdsForFeed(req);
    return sendSuccessResponse(res, 200, "Active ads fetched successfully", result);
  } catch (error) {
    logger.error("Error fetching active advertisements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Public: record impression ────────────────────────────────────────

export const recordImpression = async (req, res) => {
  try {
    const result = await recordAdImpression(req.params.id, req);
    if (result.preview) return sendSuccessResponse(res, 200, "Preview impression acknowledged", result.data);
    if (result.notFound) return sendErrorResponse(res, 404, "Advertisement not found");
    return sendSuccessResponse(res, 200, "Impression recorded", result.data);
  } catch (error) {
    logger.error("Error recording ad impression:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Public: record click ─────────────────────────────────────────────

export const recordClick = async (req, res) => {
  try {
    const result = await recordAdClick(req.params.id, req.body?.targetUrl);
    if (result.preview) return sendSuccessResponse(res, 200, "Preview click acknowledged", result.data);
    if (result.notFound) return sendErrorResponse(res, 404, "Advertisement not found");
    return sendSuccessResponse(res, 200, "Click recorded", result.data);
  } catch (error) {
    logger.error("Error recording ad click:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Public/Auth: dismiss ad ──────────────────────────────────────────

export const dismissAdvertisement = async (req, res) => {
  try {
    await dismissAd(req.params.id, req.user);
    return sendSuccessResponse(res, 200, req.params.id && req.params.id !== "admin-preview" && req.params.id !== "preview" ? "Advertisement dismissed successfully" : "Preview advertisement dismissed");
  } catch (error) {
    logger.error("Error dismissing advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Admin: list ──────────────────────────────────────────────────────

export const adminGetAdvertisements = async (req, res) => {
  try {
    const result = await getAdminAdsList(req.query);
    return sendSuccessResponse(res, 200, "Advertisements fetched successfully", result);
  } catch (error) {
    logger.error("Error listing admin advertisements:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Admin: create ────────────────────────────────────────────────────

export const adminCreateAdvertisement = async (req, res) => {
  try {
    const result = await createAdminAd(req.body, req.user._id);
    if (result.validationError) return sendErrorResponse(res, 400, result.validationError);
    return sendSuccessResponse(res, 201, "Advertisement created successfully", result);
  } catch (error) {
    logger.error("Error creating advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Admin: update ────────────────────────────────────────────────────

export const adminUpdateAdvertisement = async (req, res) => {
  try {
    const result = await updateAdminAd(req.params.id, req.body);
    if (result.invalidId) return sendErrorResponse(res, 400, "Invalid advertisement ID");
    if (result.notFound) return sendErrorResponse(res, 404, "Advertisement not found");
    return sendSuccessResponse(res, 200, "Advertisement updated successfully", result);
  } catch (error) {
    logger.error("Error updating advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Admin: delete ────────────────────────────────────────────────────

export const adminDeleteAdvertisement = async (req, res) => {
  try {
    const result = await deleteAdminAd(req.params.id);
    if (result.invalidId) return sendErrorResponse(res, 400, "Invalid advertisement ID");
    if (result.notFound) return sendErrorResponse(res, 404, "Advertisement not found");
    return sendSuccessResponse(res, 200, "Advertisement deleted successfully", result);
  } catch (error) {
    logger.error("Error deleting advertisement:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── Admin: upload banner ─────────────────────────────────────────────

export const uploadAdvertisementImageController = async (req, res) => {
  try {
    const result = processUploadedMedia(req.file);
    if (result.noFile) return sendErrorResponse(res, 400, "No media file uploaded");
    return sendSuccessResponse(res, 200, "Media uploaded successfully", result);
  } catch (error) {
    logger.error("Error uploading ad media:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── User: create with coins ──────────────────────────────────────────

export const createAdvertisementWithCoins = async (req, res) => {
  try {
    const result = await createAdWithCoins(req.body, req.user);
    if (result.validationError) return sendErrorResponse(res, 400, result.validationError);
    if (result.insufficientCoins) return sendErrorResponse(res, 400, result.message);
    return sendSuccessResponse(res, 201, "Campaign launched successfully!", result);
  } catch (error) {
    logger.error("Error creating advertisement with coins:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── User: my campaigns ───────────────────────────────────────────────

export const getMyCampaigns = async (req, res) => {
  try {
    const result = await getUserCampaigns(req.user._id);
    return sendSuccessResponse(res, 200, "Campaigns fetched successfully", result);
  } catch (error) {
    logger.error("Error fetching user campaigns:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};

// ── User: toggle campaign status ─────────────────────────────────────

export const toggleMyCampaignStatus = async (req, res) => {
  try {
    const result = await toggleCampaignStatus(req.params.id, req.user._id);
    if (result.invalidId) return sendErrorResponse(res, 400, "Invalid campaign ID");
    if (result.notFound) return sendErrorResponse(res, 404, "Campaign not found");
    if (result.expired) return sendErrorResponse(res, 400, "Cannot toggle an expired campaign");
    return sendSuccessResponse(res, 200, `Campaign ${result.status === "active" ? "resumed" : "paused"}`, result);
  } catch (error) {
    logger.error("Error toggling campaign status:", error);
    return sendErrorResponse(res, 500, "Internal Server Error");
  }
};
