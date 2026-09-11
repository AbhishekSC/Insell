import express from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { schedule, list, cancel, markStarted, runCallReminders } from "./communityCall.controller.js";

const router = express.Router();

// Cron endpoint first, before the auth gate — it authenticates itself via
// the x-cron-secret header, same as the digest/stalled-deals crons.
router.post("/cron/reminders", runCallReminders);

router.use(verifyUser);
router.use(requireVerified);

router.get("/:circleId", list);
router.post("/:circleId", schedule);
router.post("/:circleId/:callId/cancel", cancel);
router.post("/:circleId/:callId/started", markStarted);

export default router;
