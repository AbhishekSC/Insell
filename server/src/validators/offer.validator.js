import { body, param } from "express-validator";

export const createOfferRules = [
  param("postId").isMongoId().withMessage("Invalid post ID"),
  body("amount")
    .isNumeric().withMessage("Amount must be a number")
    .custom((v) => v > 0).withMessage("Amount must be positive"),
  body("message")
    .optional()
    .isString()
    .isLength({ max: 500 }).withMessage("Message must be under 500 characters"),
];

export const respondToOfferRules = [
  param("offerId").isMongoId().withMessage("Invalid offer ID"),
  body("action")
    .isIn(["accept", "counter", "decline"]).withMessage("Action must be accept, counter, or decline"),
  body("counterAmount")
    .if(body("action").equals("counter"))
    .isNumeric().withMessage("Counter amount must be a number")
    .custom((v) => v > 0).withMessage("Counter amount must be positive"),
];
