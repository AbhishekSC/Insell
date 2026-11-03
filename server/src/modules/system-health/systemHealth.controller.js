import { getSystemHealth } from "./systemHealth.service.js";
import { logger } from "../../utils/logger.js";

export async function getDetailedHealth(req, res) {
  try {
    const health = await getSystemHealth();
    const httpStatus = health.status === "unhealthy" ? 503 : 200;
    return res.status(httpStatus).json(health);
  } catch (error) {
    logger.error("Health check failed:", error);
    return res.status(503).json({ status: "unhealthy", message: "Health check failed" });
  }
}
