import express from "express";
import {
  getActiveAdvertisements,
  recordImpression,
  recordClick,
  dismissAdvertisement,
  createAdvertisementWithCoins,
  getMyCampaigns,
  toggleMyCampaignStatus,
  uploadAdvertisementImageController,
} from "../controllers/advertisement.controller.js";
import { attachOptionalUser, verifyUser } from "../middlewares/auth.middleware.js";
import { uploadAdvertisementImage } from "../middlewares/upload.middleware.js";

const router = new express.Router();

// Public / Authenticated routes for marketplace feed and telemetry
router.get("/active", attachOptionalUser, getActiveAdvertisements);
router.post("/:id/impression", attachOptionalUser, recordImpression);
router.post("/:id/click", recordClick);
router.post("/:id/dismiss", attachOptionalUser, dismissAdvertisement);

// User Self-Serve "Ad Tools" routes (authenticated)
router.get("/user/my-campaigns", verifyUser, getMyCampaigns);
router.post("/user/create-with-coins", verifyUser, createAdvertisementWithCoins);
router.post("/user/upload-banner", verifyUser, uploadAdvertisementImage.single("image"), uploadAdvertisementImageController);
router.patch("/user/my-campaigns/:id/status", verifyUser, toggleMyCampaignStatus);

export default router;
