import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  compareProperties,
  createPropertyPost,
  deletePropertyPost,
  getPropertyAnalytics,
  getPropertyFeed,
  getPropertyPostById,
  incrementViewCount,
  togglePropertyPostLike,
  togglePropertyPostSave,
  updatePropertyPost,
  uploadPropertyMedia as uploadPropertyMediaController,
} from "../controllers/propertyPost.controller.js";
import { uploadPropertyMedia } from "../middlewares/upload.middleware.js";

const router = new express.Router();

router.get("/", verifyUser, getPropertyFeed);
router.get("/:id", verifyUser, getPropertyPostById);
router.get("/:id/analytics", verifyUser, getPropertyAnalytics);
router.post("/", verifyUser, createPropertyPost);
router.post("/compare", verifyUser, compareProperties);
router.put("/:id", verifyUser, updatePropertyPost);
router.delete("/:id", verifyUser, deletePropertyPost);
router.post("/upload-media", verifyUser, uploadPropertyMedia.array("media", 5), uploadPropertyMediaController);
router.post("/:id/like", verifyUser, togglePropertyPostLike);
router.post("/:id/save", verifyUser, togglePropertyPostSave);
router.post("/:id/view", verifyUser, incrementViewCount);

export default router;
