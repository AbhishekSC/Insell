import express from "express";
import { getPublicUserProfile } from "./publicProfile.controller.js";

// Public, unauthenticated. Mounted at /api/public.
const router = new express.Router();

router.get("/users/:id", getPublicUserProfile);

export default router;
