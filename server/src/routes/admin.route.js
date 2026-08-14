import express from "express";
import { verifyUser, requireVerified, requireAdmin } from "../middlewares/auth.middleware.js";
import { getAdminUsers, toggleUserBlock } from "../controllers/admin.controller.js";

const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);
router.use(requireAdmin);

router.get("/users", getAdminUsers);
router.post("/users/:id/block", toggleUserBlock);

export default router;
