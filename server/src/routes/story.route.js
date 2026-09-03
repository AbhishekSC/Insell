import express from "express";
import {
  createStory,
  getActiveStories,
  getUserStories,
  getMyStories,
  deleteStory,
  uploadStoryMedia,
  toggleStoryLike,
  getStoryLikes,
  getStoryViewers,
} from "../controllers/story.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { uploadStoryMedia as upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyUser);
router.use(requireVerified);

// Upload story media
router.post("/upload-media", upload.single("media"), uploadStoryMedia);

// Create a new story
router.post("/", createStory);

// Get all active stories (feed)
router.get("/", getActiveStories);

// Get stories by specific user
router.get("/user/:userId", getUserStories);

// Get current user's stories
router.get("/my", getMyStories);

// Like / unlike a story
router.post("/:storyId/like", toggleStoryLike);

// Get the users who liked a story (story owner only)
router.get("/:storyId/likes", getStoryLikes);

// Get the users who viewed a story, most-recent-first (story owner only)
router.get("/:storyId/viewers", getStoryViewers);

// Delete a story
router.delete("/:storyId", deleteStory);

export default router;
