import { generateStreamToken } from "../services/stream.service.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler";

export async function getStreamToken(req, res) {
  try {
    const token = generateStreamToken(req.user.id);

    sendSuccessResponse(res, 200, "Stream token generated successfully", {
      token,
    });
  } catch (error) {
    console.error("Error generating stream token:", error);
    sendErrorResponse(
      res,
      500,
      "Internal server error",
      { error: error.message },
      error
    );
  }
}
