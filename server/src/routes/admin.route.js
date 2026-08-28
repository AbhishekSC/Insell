import express from "express";
import { verifyUser, requireVerified, requireAdmin } from "../middlewares/auth.middleware.js";
import { uploadAnnouncementImage } from "../middlewares/upload.middleware.js";
import {
  getAdminUsers,
  toggleUserBlock,
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
} from "../controllers/admin.controller.js";

const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);
router.use(requireAdmin);

router.get("/users", getAdminUsers);
router.post("/users/:id/block", toggleUserBlock);

router.get("/posts", getAdminPosts);
router.post("/posts/:id/block", blockPost);
router.post("/posts/:id/unblock", unblockPost);

router.get("/reports", getAdminReports);
router.get("/reports/:postId", getAdminReportDetail);
router.post("/reports/:postId/dismiss", dismissPostReports);

router.get("/live-users-count", getLiveUsersCount);

router.get("/feedback", getAdminFeedback);
router.post("/feedback/:id/resolve", resolveFeedback);

router.get("/announcements", getAnnouncements);
router.post("/announcements", createAnnouncement);
router.post("/announcements/upload-image", uploadAnnouncementImage.single("image"), uploadAnnouncementImageController);

export default router;
