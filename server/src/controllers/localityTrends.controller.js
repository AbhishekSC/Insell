import LocalityTrendsService from "../services/LocalityTrendsService.js";
import { sendSuccessResponse, sendErrorResponse } from "../utils/responseHandler.js";

const service = new LocalityTrendsService();

export async function getLocalityOverview(req, res) {
  try {
    const { city, intent = "buy" } = req.query;
    if (!city) {
      return sendErrorResponse(res, 400, "city query parameter is required");
    }
    const data = await service.getLocalityOverview({ city, intent });
    return sendSuccessResponse(res, 200, "Locality overview fetched", data);
  } catch (err) {
    return sendErrorResponse(res, 500, err.message);
  }
}

export async function getLocalityDetail(req, res) {
  try {
    const { city, locality, intent = "buy" } = req.query;
    if (!city || !locality) {
      return sendErrorResponse(res, 400, "city and locality query parameters are required");
    }
    const data = await service.getLocalityDetail({ city, locality, intent });
    return sendSuccessResponse(res, 200, "Locality detail fetched", data);
  } catch (err) {
    return sendErrorResponse(res, 500, err.message);
  }
}

export async function getMonthlyTrends(req, res) {
  try {
    const { city, locality, intent = "buy", months = "12" } = req.query;
    if (!city) {
      return sendErrorResponse(res, 400, "city query parameter is required");
    }
    const data = await service.getMonthlyTrends({
      city,
      locality: locality || null,
      intent,
      months: Math.min(Number(months) || 12, 24),
    });
    return sendSuccessResponse(res, 200, "Monthly trends fetched", data);
  } catch (err) {
    return sendErrorResponse(res, 500, err.message);
  }
}
