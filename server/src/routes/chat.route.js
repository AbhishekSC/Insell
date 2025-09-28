import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { getStreamToken } from "../controllers/chat.controller.js";

const router = express.Router();

router.get("/token", verifyUser, getStreamToken);

export default router;
