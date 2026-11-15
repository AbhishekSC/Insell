import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { validateRequest } from "../../middlewares/validation.js";
import { rateMealRules, pgIdRules, monthlyRules } from "../../validators/mealRating.validator.js";
import { rateMeal, getDailyRatings, getMonthlyBreakdown, getFoodScore, getFoodTrend } from "./mealRating.controller.js";

const router = Router();

router.post("/", verifyUser, requireVerified, rateMealRules, validateRequest, rateMeal);
router.get("/:pgId/daily", verifyUser, requireVerified, pgIdRules, validateRequest, getDailyRatings);
router.get("/:pgId/monthly", verifyUser, requireVerified, monthlyRules, validateRequest, getMonthlyBreakdown);
router.get("/:pgId/score", verifyUser, requireVerified, pgIdRules, validateRequest, getFoodScore);
router.get("/:pgId/trend", verifyUser, requireVerified, pgIdRules, validateRequest, getFoodTrend);

export default router;
