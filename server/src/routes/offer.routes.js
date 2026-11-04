import express from "express";
import {
  createOffer,
  getPostOffers,
  getMyOfferForPost,
  respondToOffer,
} from "../controllers/offer.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { validateRequest } from "../middlewares/validation.js";
import { createOfferRules, respondToOfferRules } from "../validators/offer.validator.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

/**
 * @swagger
 * /api/v1/offers/posts/{postId}/offers:
 *   post:
 *     tags: [Offers]
 *     summary: Make an offer on a property post
 *     security: [{ cookieAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount: { type: number, minimum: 1 }
 *               message: { type: string, maxLength: 500 }
 *     responses:
 *       201: { description: Offer created }
 *       400: { description: Validation error }
 */
router.post("/posts/:postId/offers", createOfferRules, validateRequest, createOffer);
router.get("/posts/:postId/offers", getPostOffers);
router.get("/posts/:postId/offers/mine", getMyOfferForPost);
router.patch("/:offerId", respondToOfferRules, validateRequest, respondToOffer);

export default router;
