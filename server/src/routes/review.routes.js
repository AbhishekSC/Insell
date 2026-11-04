import express from "express";
import { createReview, getUserReviews } from "../controllers/review.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validation.js";
import { createReviewRules, getUserReviewsRules } from "../validators/review.validator.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.post("/offers/:offerId/reviews", createReviewRules, validateRequest, createReview);
router.get("/users/:userId/reviews", getUserReviewsRules, validateRequest, getUserReviews);

export default router;
