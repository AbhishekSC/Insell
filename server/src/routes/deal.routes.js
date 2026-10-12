import express from "express";
import {
  getMyDeals,
  getDealForPost,
  updateDeal,
  addDealAttachment,
  removeDealAttachment,
  verifyDealAttachment,
  getDealSummary,
  nudgeStalledDeals,
  verifyPublicClosingStatement,
} from "../controllers/deal.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { uploadDealDocument } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Public unauthenticated verification endpoint (for bankers, auditors, lawyers via QR code)
router.get("/verify-statement/:token", verifyPublicClosingStatement);

// Cron sweep — authenticated by a shared secret header, not a user session.
router.post("/cron/nudge-stalled", nudgeStalledDeals);

router.use(verifyUser);
router.use(requireVerified);

router.get("/mine", getMyDeals);
router.get("/post/:postId", getDealForPost);
router.get("/:id/summary", getDealSummary);
router.patch("/:id", updateDeal);
router.post("/:id/attachments", uploadDealDocument.single("file"), addDealAttachment);
router.post("/:id/attachments/:attId/verify", verifyDealAttachment);
router.delete("/:id/attachments/:attId", removeDealAttachment);

export default router;
