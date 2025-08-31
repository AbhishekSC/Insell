import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  getMyFriends,
  getRecommendedUsers,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
  getOutgoingFriendRequests,
  rejectFriendRequest
} from "../controllers/user.controller.js";

const router = new express.Router();

// **Middlewares (apply this middleware to all routes in this file)- Global middleware**
router.use(verifyUser);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);

// Friend Request Routes
router.post("/friend-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.put("/friend-request/:id/reject", rejectFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendRequests);

export default router;
