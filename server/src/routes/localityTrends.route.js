import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import {
  getLocalityOverview,
  getLocalityDetail,
  getMonthlyTrends,
} from "../controllers/localityTrends.controller.js";

const router = express.Router();

router.get("/overview", verifyUser, requireVerified, getLocalityOverview);
router.get("/detail", verifyUser, requireVerified, getLocalityDetail);
router.get("/trends", verifyUser, requireVerified, getMonthlyTrends);

export default router;
