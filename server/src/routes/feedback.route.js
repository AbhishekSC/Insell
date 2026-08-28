import express from "express";
import { createFeedback } from "../controllers/feedback.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { uploadFeedbackScreenshot } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.post("/", uploadFeedbackScreenshot.single("screenshot"), createFeedback);

export default router;
