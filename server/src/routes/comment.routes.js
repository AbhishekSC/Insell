import express from "express";
import {
  createComment,
  deleteComment,
  getPostComments,
  likeComment,
  getCommentReplies,
  trackReplyView,
} from "../controllers/comment.controller.js";
import { verifyUser } from "../middlewares/auth.middleware.js";

const router = express.Router();

// All comment routes require authentication
router.use(verifyUser);

// Create a comment on a post
router.post("/posts/:postId/comments", createComment);

// Get all comments for a post
router.get("/posts/:postId/comments", getPostComments);

// Get replies for a specific comment
router.get("/:commentId/replies", getCommentReplies);

// Track reply view for personalization
router.post("/:commentId/view-replies", trackReplyView);

// Like/unlike a comment
router.post("/:commentId/like", likeComment);

// Delete a comment
router.delete("/:commentId", deleteComment);

export default router;
