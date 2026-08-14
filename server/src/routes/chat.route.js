import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { getStreamToken, getPrioritizedConversations } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token", verifyUser, requireVerified, getStreamToken);
router.get("/conversations/prioritized", verifyUser, requireVerified, getPrioritizedConversations);

export default router;
