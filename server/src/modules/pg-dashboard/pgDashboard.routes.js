import { Router } from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { getOwnerDashboard, getPgOverview } from "./pgDashboard.controller.js";

const router = Router();

router.get("/", verifyUser, requireVerified, getOwnerDashboard);
router.get("/overview", verifyUser, requireVerified, getPgOverview);

export default router;
