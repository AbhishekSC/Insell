import express from "express";
import {
  getMyDeals,
  getDealForPost,
  updateDeal,
  addDealAttachment,
  removeDealAttachment,
  nudgeStalledDeals,
} from "../controllers/deal.controller.js";
import { verifyUser, requireVerified } from "../middlewares/auth.middleware.js";
import { uploadDealDocument } from "../middlewares/upload.middleware.js";

const router = express.Router();

// Cron sweep — authenticated by a shared secret header, not a user session.
router.post("/cron/nudge-stalled", nudgeStalledDeals);

router.use(verifyUser);
router.use(requireVerified);

router.get("/mine", getMyDeals);
router.get("/post/:postId", getDealForPost);
router.patch("/:id", updateDeal);
router.post("/:id/attachments", uploadDealDocument.single("file"), addDealAttachment);
router.delete("/:id/attachments/:attId", removeDealAttachment);

export default router;
