import express from 'express';
import { verifyUser } from "../middlewares/auth.middleware.js";
import { generateStreamToken } from '../services/stream.service.js';

const router= express.Router();


router.get("/token", verifyUser, generateStreamToken);

export default router;