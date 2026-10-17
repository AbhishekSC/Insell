import express from "express";
import { verifyUser } from "../middlewares/auth.middleware.js";
import { getMyWallet, getMyPassbook } from "../controllers/wallet.controller.js";

const router = express.Router();

router.use(verifyUser);

router.get("/me", getMyWallet);
router.get("/history", getMyPassbook);

export default router;
