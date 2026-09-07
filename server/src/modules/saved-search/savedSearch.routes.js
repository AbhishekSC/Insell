import express from "express";
import { verifyUser, requireVerified } from "../../middlewares/auth.middleware.js";
import { getMine, create, update, remove } from "./savedSearch.controller.js";

// Mounted at /api/saved-searches
const router = new express.Router();

router.use(verifyUser);
router.use(requireVerified);

router.get("/", getMine);
router.post("/", create);
router.patch("/:id", update);
router.delete("/:id", remove);

export default router;
