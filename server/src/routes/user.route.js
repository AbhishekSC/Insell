import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  getMyFriends,
  getRecommendedUsers,
  sendFriendRequest
} from "../controllers/user.controller.js";

const router = new express.Router();

// **Middlewares (apply this middleware to all routes in this file)- Global middleware**
router.use(verifyUser);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);

router.post("/friend-request", sendFriendRequest);

export default router;
