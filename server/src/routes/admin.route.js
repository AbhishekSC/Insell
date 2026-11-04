import express from "express";
import { verifyUser, requireVerified, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadAnnouncementImage, uploadAdvertisementImage } from "../middlewares/upload.middleware.js";
import { getQueuesHealth } from "../jobs/bullboard.js";
import { getDetailedHealth } from "../modules/system-health/systemHealth.controller.js";
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
import { validateRequest } from "../middlewares/validation.js";
import {
  toggleUserBlockRules,
  adminCreditCoinsRules,
  createAnnouncementRules,
  reviewVerificationRules,
} from "../validators/admin.validator.js";
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
router.post("/users/:id/block", toggleUserBlockRules, validateRequest, toggleUserBlock);
router.get("/users/:id/wallet", adminGetUserWallet);
router.post("/users/:id/credit-coins", adminCreditCoinsRules, validateRequest, adminCreditCoins);
router.get("/coin-history", adminGetCoinHistory);

router.get("/posts", getAdminPosts);
router.post("/posts/:id/block", blockPost);
router.post("/posts/:id/unblock", unblockPost);

router.get("/property-verifications", getAdminPropertyVerifications);
router.patch("/property-verifications/:id", reviewVerificationRules, validateRequest, reviewPropertyVerification);
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
router.post("/announcements", createAnnouncementRules, validateRequest, createAnnouncement);
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

// Queue observability
router.get("/queues/health", async (req, res) => {
  const health = await getQueuesHealth();
  const hasFailures = Object.values(health).some((q) => (q.failed || 0) > 0);
  res.json({ status: hasFailures ? "degraded" : "healthy", queues: health });
});

/**
 * @swagger
 * /api/v1/admin/system-health:
 *   get:
 *     tags: [Admin, Health]
 *     summary: Comprehensive infrastructure health check
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200:
 *         description: System health report
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SystemHealth' }
 */
router.get("/system-health", getDetailedHealth);

export default router;
