import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { createSession, getMySessions, rescheduleSession } from "../controllers/session.controller.js";

const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.post("/", createSession);
router.get("/my", getMySessions);
router.patch("/:id/reschedule", rescheduleSession);

export default router;
