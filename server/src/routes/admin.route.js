import express from "express";
import { verifyUser, requireVerified, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadAnnouncementImage, uploadAdvertisementImage } from "../middlewares/upload.middleware.js";
import { getDealStats, adminListDeals, adminResolveDealReports, adminForceCancelDeal } from "../controllers/deal.controller.js";
import {
  getAdminUsers,
  toggleUserBlock,
  adminCreditCoins,
  adminGetUserWallet,
  adminGetCoinHistory,
  getAdminPosts,
  blockPost,
  unblockPost,
  getAdminReports,
  getAdminReportDetail,
  dismissPostReports,
  createAnnouncement,
  getAnnouncements,
  uploadAnnouncementImageController,
  getLiveUsersCount,
  getAdminFeedback,
  resolveFeedback,
  getAdminPropertyVerifications,
  reviewPropertyVerification,
  downloadPropertyBill,
} from "../controllers/admin.controller.js";
import {
  adminListFeatureFlags,
  adminCreateFeatureFlag,
  adminUpdateFeatureFlag,
  adminDeleteFeatureFlag,
  adminAddUserToWhitelist,
} from "../controllers/featureFlag.controller.js";
import {
  adminGetAdvertisements,
  adminCreateAdvertisement,
  adminUpdateAdvertisement,
  adminDeleteAdvertisement,
  uploadAdvertisementImageController,
} from "../controllers/advertisement.controller.js";

const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);
router.use(requireAdmin);

router.get("/users", getAdminUsers);
router.post("/users/:id/block", toggleUserBlock);
router.get("/users/:id/wallet", adminGetUserWallet);
router.post("/users/:id/credit-coins", adminCreditCoins);
router.get("/coin-history", adminGetCoinHistory);

router.get("/posts", getAdminPosts);
router.post("/posts/:id/block", blockPost);
router.post("/posts/:id/unblock", unblockPost);

router.get("/property-verifications", getAdminPropertyVerifications);
router.patch("/property-verifications/:id", reviewPropertyVerification);
router.get("/property-verifications/:id/bill-download", downloadPropertyBill);

router.get("/reports", getAdminReports);
router.get("/reports/:postId", getAdminReportDetail);
router.post("/reports/:postId/dismiss", dismissPostReports);

router.get("/live-users-count", getLiveUsersCount);

router.get("/feedback", getAdminFeedback);
router.post("/feedback/:id/resolve", resolveFeedback);

router.get("/deal-stats", getDealStats);
router.get("/deals", adminListDeals);
router.post("/deals/:id/resolve-report", adminResolveDealReports);
router.post("/deals/:id/force-cancel", adminForceCancelDeal);

router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncement);
router.post("/announcements/upload-image", uploadAnnouncementImage.single("image"), uploadAnnouncementImageController);

// Feature Flags management
router.get("/feature-flags", adminListFeatureFlags);
router.post("/feature-flags", adminCreateFeatureFlag);
router.patch("/feature-flags/:id", adminUpdateFeatureFlag);
router.delete("/feature-flags/:id", adminDeleteFeatureFlag);
router.post("/feature-flags/:id/whitelist-user", adminAddUserToWhitelist);

// Advertisements management
router.get("/advertisements", adminGetAdvertisements);
router.post("/advertisements", adminCreateAdvertisement);
router.patch("/advertisements/:id", adminUpdateAdvertisement);
router.delete("/advertisements/:id", adminDeleteAdvertisement);
router.post("/advertisements/upload-image", uploadAdvertisementImage.single("image"), uploadAdvertisementImageController);

export default router;
