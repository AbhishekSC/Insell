import express from "express";
import { createReview, getUserReviews } from "../controllers/review.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

// Leave a review after an offer has been accepted
router.post("/offers/:offerId/reviews", createReview);

// View a user's reviews + aggregate rating
router.get("/users/:userId/reviews", getUserReviews);

export default router;
