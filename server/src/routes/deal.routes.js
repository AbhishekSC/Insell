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
import { validateRequest } from "../middlewares/validation.js";
import { updateDealRules, addDealAttachmentRules, verifyDealAttachmentRules } from "../validators/deal.validator.js";

const router = express.Router();

router.get("/verify-statement/:token", verifyPublicClosingStatement);
router.post("/cron/nudge-stalled", nudgeStalledDeals);

router.use(verifyUser);
router.use(requireVerified);

router.get("/mine", getMyDeals);
router.get("/post/:postId", getDealForPost);
router.get("/:id/summary", getDealSummary);
router.patch("/:id", updateDealRules, validateRequest, updateDeal);
router.post("/:id/attachments", addDealAttachmentRules, validateRequest, uploadDealDocument.single("file"), addDealAttachment);
router.post("/:id/attachments/:attId/verify", verifyDealAttachmentRules, validateRequest, verifyDealAttachment);
router.delete("/:id/attachments/:attId", removeDealAttachment);

export default router;
