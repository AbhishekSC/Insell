import express from "express";
import { login, logout, signup } from "../controllers/auth.controller.js";
import { loginValidation, signupValidation } from "../middlewares/authValidation.middleware.js";

const router= new express.Router();

router.post("/signup", signupValidation, signup);
router.post("/login", loginValidation, login);
router.post("/logout", logout);

export default router;