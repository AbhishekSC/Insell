import express from "express";
import {
  getActiveAdvertisements,
  recordImpression,
  recordClick,
  dismissAdvertisement,
} from "../controllers/advertisement.controller.js";
import { attachOptionalUser } from "../middlewares/auth.middleware.js";

const router = new express.Router();

// Public / Authenticated routes for marketplace feed and telemetry
router.get("/active", attachOptionalUser, getActiveAdvertisements);
router.post("/:id/impression", attachOptionalUser, recordImpression);
router.post("/:id/click", recordClick);
router.post("/:id/dismiss", attachOptionalUser, dismissAdvertisement);

export default router;
