import express from "express";
import * as controller from "../modules/neighbourhood-safety/neighbourhoodSafety.controller.js";

const router = express.Router();

router.get("/district", controller.getDistrictSafety);
router.get("/overview", controller.getSafetyOverview);

export default router;
