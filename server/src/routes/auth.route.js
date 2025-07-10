import express from "express";
import {
  login,
  logout,
  onboarding,
  signup,
} from "../controllers/auth.controller.js";
import {
  loginValidation,
  signupValidation,
} from "../middlewares/authValidation.middleware.js";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { sendSuccessResponse } from "../utils/responseHandler.js";

const router = new express.Router();

router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);
router.post("/logout", logout);

router.post("/onboarding", verifyUser, onboarding);

router.get("/verify", verifyUser, (req, res) => {
  sendSuccessResponse(res, 200, "User verified successfully", {
    user: req.user,
  });
});

export default router;
