import express from "express";
import { verifyUser, requireVerified, requireAdmin } from "../../middlewares/auth.middleware.js";
import { uploadOwnerVerificationDoc } from "../../middlewares/upload.middleware.js";
import { getStatus, submit, adminQueue, adminReview } from "./ownerVerification.controller.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.get("/status", getStatus);
router.post("/", uploadOwnerVerificationDoc.single("document"), submit);

router.get("/admin/queue", requireAdmin, adminQueue);
router.patch("/admin/:id", requireAdmin, adminReview);

export default router;
