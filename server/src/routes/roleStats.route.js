import express from "express";
import { getRoleStats } from "../controllers/roleStats.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * GET /role-stats
 * Get role-based statistics for the current user
 */
router.get("/", verifyUser, requireVerified, getRoleStats);

export default router;
