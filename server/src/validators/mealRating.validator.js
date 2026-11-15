import { body, param, query } from "express-validator";
import { MEAL_TYPES } from "../models/MealRating.model.js";

export const rateMealRules = [
  body("pgId").isMongoId().withMessage("Invalid PG ID"),
  body("mealType").isIn(MEAL_TYPES).withMessage(`Meal type must be one of: ${MEAL_TYPES.join(", ")}`),
  body("rating").isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
  body("date").optional().isISO8601().withMessage("Invalid date"),
  body("comment").optional().isString().isLength({ max: 200 }).withMessage("Comment must be under 200 chars"),
  body("photo").optional().isString().isLength({ max: 500 }),
];

export const pgIdRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
];

export const monthlyRules = [
  param("pgId").isMongoId().withMessage("Invalid PG ID"),
  query("month").optional().isInt({ min: 1, max: 12 }),
  query("year").optional().isInt({ min: 2020, max: 2100 }),
];
