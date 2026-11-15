import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import {
  createReviewRules,
  getReviewsRules,
  markHelpfulRules,
  deleteReviewRules,
} from "../../validators/pgReview.validator.js";
import {
  createReview,
  getReviews,
  getRatingSummary,
  markHelpful,
  deleteReview,
} from "./pgReview.controller.js";

const router = Router();

router.post("/:pgId", verifyUser, requireVerified, createReviewRules, validateRequest, createReview);
router.get("/:pgId", verifyUser, requireVerified, getReviewsRules, validateRequest, getReviews);
router.get("/:pgId/summary", verifyUser, requireVerified, getRatingSummary);
router.post("/:reviewId/helpful", verifyUser, requireVerified, markHelpfulRules, validateRequest, markHelpful);
router.delete("/:reviewId", verifyUser, requireVerified, deleteReviewRules, validateRequest, deleteReview);

export default router;
