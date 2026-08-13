import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { getStreamToken, getPrioritizedConversations } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token", verifyUser, getStreamToken);
router.get("/conversations/prioritized", verifyUser, getPrioritizedConversations);

export default router;
