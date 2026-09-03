import express from "express";
import {
  createVisitRequest,
  respondToVisitRequest,
  getPostVisitRequests,
  getMyVisitForPost,
} from "../controllers/visitRequest.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.post("/posts/:postId/visits", createVisitRequest);
router.get("/posts/:postId/visits", getPostVisitRequests);
router.get("/posts/:postId/visits/mine", getMyVisitForPost);
router.patch("/:visitId", respondToVisitRequest);

export default router;
