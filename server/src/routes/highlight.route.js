import express from "express";
import {
  createHighlight,
  addStoryToHighlight,
  removeStoryFromHighlight,
  getUserHighlights,
  getHighlightById,
  updateHighlight,
  deleteHighlight,
} from "../controllers/highlight.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.post("/", createHighlight);
router.get("/user/:userId", getUserHighlights);
router.get("/:id", getHighlightById);
router.patch("/:id", updateHighlight);
router.delete("/:id", deleteHighlight);
router.post("/:id/stories", addStoryToHighlight);
router.delete("/:id/stories/:storyId", removeStoryFromHighlight);

export default router;
