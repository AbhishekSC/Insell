import express from "express";
import {
  createOffer,
  getPostOffers,
  getMyOfferForPost,
  respondToOffer,
} from "../controllers/offer.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

// Make an offer on a post
router.post("/posts/:postId/offers", createOffer);

// Owner: view all offers on their post
router.get("/posts/:postId/offers", getPostOffers);

// Buyer: check their own (most recent) offer status on a post
router.get("/posts/:postId/offers/mine", getMyOfferForPost);

// Accept / counter / decline an offer
router.patch("/:offerId", respondToOffer);

export default router;
