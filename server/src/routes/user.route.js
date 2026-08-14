import express from "express";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import {
  getMyFriends,
  getRecommendedUsers,
  getDiscoverUsers,
  sendFriendRequest,
  acceptFriendRequest,
  getFriendRequests,
  getOutgoingFriendRequests,
  rejectFriendRequest,
  updateMyProfile,
  getUserPublicProfile,
  updateUserLocation,
  getUserActivity,
} from "../controllers/user.controller.js";
import { uploadProfileImage } from "../middlewares/upload.middleware.js";

const router = new express.Router();

// **Middlewares (apply this middleware to all routes in this file)- Global middleware**
router.use(verifyUser);
router.use(requireVerified);

router.get("/", getRecommendedUsers);
router.get("/discover", getDiscoverUsers);
router.get("/friends", getMyFriends);
router.get("/connections", getMyFriends);
router.get("/:id/profile", getUserPublicProfile);
router.patch("/profile", uploadProfileImage.single("profileImage"), updateMyProfile);
router.patch("/account", uploadProfileImage.single("profileImage"), updateMyProfile);
router.patch("/location", updateUserLocation);

// Friend Request Routes
router.post("/friend-request/:id", sendFriendRequest);
router.post("/connection-request/:id", sendFriendRequest);
router.put("/friend-request/:id/accept", acceptFriendRequest);
router.put("/connection-request/:id/accept", acceptFriendRequest);
router.put("/friend-request/:id/reject", rejectFriendRequest);
router.put("/connection-request/:id/reject", rejectFriendRequest);

router.get("/friend-requests", getFriendRequests);
router.get("/connection-requests", getFriendRequests);
router.get("/outgoing-friend-requests", getOutgoingFriendRequests);
router.get("/outgoing-connection-requests", getOutgoingFriendRequests);
router.get("/activity", getUserActivity);

export default router;
