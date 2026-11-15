import * as service from "./neighbourhoodSafety.service.js";
import { logger } from "../../utils/logger.js";

export async function getDistrictSafety(req, res) {
  try {
    const { district, state } = req.query;
    if (!district) {
      return res.status(400).json({ success: false, message: "district is required" });
    }

    const data = await service.getDistrictSafetyInsights(district, state);
    return res.json({ success: true, data });
  } catch (error) {
    logger.error("Error fetching district safety data:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch safety data" });
  }
}

export async function getSafetyOverview(req, res) {
  try {
    const { lat, lng, locality, city, district, state } = req.query;
    if (!lat || !lng) {
      return res.status(400).json({ success: false, message: "lat and lng are required" });
    }

    const data = await service.getSafetyOverview(
      Number(lat),
      Number(lng),
      locality,
      city,
      district,
      state
    );
    return res.json({ success: true, data });
  } catch (error) {
    logger.error("Error fetching safety overview:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch safety overview" });
  }
}
