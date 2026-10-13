import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { getMyEvaluatedFlags } from "../controllers/featureFlag.controller.js";

const router = express.Router();

// GET /api/feature-flags/my-flags (Evaluated flags for the logged in user)
router.get("/my-flags", verifyUser, getMyEvaluatedFlags);

export default router;
