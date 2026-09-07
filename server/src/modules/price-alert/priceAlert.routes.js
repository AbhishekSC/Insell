import express from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { getMine, getForPost, setForPost, removeForPost } from "./priceAlert.controller.js";

// Mounted at /api/price-alerts
const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.get("/mine", getMine);
router.get("/post/:postId", getForPost);
router.put("/post/:postId", setForPost);
router.delete("/post/:postId", removeForPost);

export default router;
