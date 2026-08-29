import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import {
  compareProperties,
  createPropertyPost,
  deletePropertyPost,
  getLatestFeedPost,
  getPropertyAnalytics,
  getPropertyFeed,
  getPropertyMediaUploadSignature,
  getPropertyPostById,
  incrementViewCount,
  reportPost,
  togglePropertyPostLike,
  togglePropertyPostSave,
  updatePropertyPost,
  uploadPropertyMedia as uploadPropertyMediaController,
} from "../controllers/propertyPost.controller.js";
import { uploadPropertyMedia } from "../middlewares/upload.middleware.js";

const router = new express.Router();

router.get("/", verifyUser, requireVerified, getPropertyFeed);
router.get("/latest", verifyUser, requireVerified, getLatestFeedPost);
router.get("/:id", verifyUser, requireVerified, getPropertyPostById);
router.get("/:id/analytics", verifyUser, requireVerified, getPropertyAnalytics);
router.post("/", verifyUser, requireVerified, createPropertyPost);
router.post("/compare", verifyUser, requireVerified, compareProperties);
router.put("/:id", verifyUser, requireVerified, updatePropertyPost);
router.delete("/:id", verifyUser, requireVerified, deletePropertyPost);
router.post("/upload-media", verifyUser, requireVerified, uploadPropertyMedia.array("media", 5), uploadPropertyMediaController);
router.get("/upload-media/signature", verifyUser, requireVerified, getPropertyMediaUploadSignature);
router.post("/:id/like", verifyUser, requireVerified, togglePropertyPostLike);
router.post("/:id/save", verifyUser, requireVerified, togglePropertyPostSave);
router.post("/:id/view", verifyUser, requireVerified, incrementViewCount);
router.post("/:id/report", verifyUser, requireVerified, reportPost);

export default router;
