import { logger } from "../../utils/logger.js";
import * as roleStatsService from "./roleStats.service.js";

/**
 * Get role-based statistics for the user
 */
export async function getRoleStats(req, res) {
  try {
    const userId = req.user?._id;

    const result = await roleStatsService.computeRoleStats(userId);

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        role: result.role,
        stats: result.stats,
        widgets: result.widgets,
      },
    });
  } catch (error) {
    logger.error("Error fetching role stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch role statistics",
    });
  }
}
