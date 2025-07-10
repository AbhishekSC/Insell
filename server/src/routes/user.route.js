import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import {
  getMyFriends,
  getRecommendedUsers,
} from "../controllers/user.controller.js";

const router = express.Router();

// **Middlewares (apply this middleware to all routes in this file)**
router.use(verifyUser);

router.get("/", getRecommendedUsers);
router.get("/friends", getMyFriends);

export default router;