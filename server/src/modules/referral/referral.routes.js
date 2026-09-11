import express from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { getMine } from "./referral.controller.js";

const router = express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.get("/me", getMine);

export default router;
