import express from "express";
import {
  createStory,
  getActiveStories,
  getUserStories,
  getMyStories,
  deleteStory,
  uploadStoryMedia,
} from "../controllers/story.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { uploadStoryMedia as upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

// All routes require authentication
router.use(verifyUser);

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

// Delete a story
router.delete("/:storyId", deleteStory);

export default router;
