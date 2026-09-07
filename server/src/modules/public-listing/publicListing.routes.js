import express from "express";
import {
  getListingSharePreview,
  getPublicListing,
  recordListingShare,
} from "./publicListing.controller.js";

// Public, unauthenticated routes. Mounted at /api/public.
const router = new express.Router();

router.get("/listings/:id/preview", getListingSharePreview);
router.get("/listings/:id", getPublicListing);
router.post("/listings/:id/share", recordListingShare);

export default router;
