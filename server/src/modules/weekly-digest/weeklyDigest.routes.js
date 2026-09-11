import express from "express";
import { runWeeklyDigest } from "./weeklyDigest.controller.js";

const router = express.Router();

router.post("/cron/weekly", runWeeklyDigest);

export default router;
