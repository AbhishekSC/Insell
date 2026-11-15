import * as service from "./issueReport.service.js";
import { sendSuccessResponse, sendErrorResponse } from "../../utils/responseHandler.js";
import { logger } from "../../utils/logger.js";

export async function createIssue(req, res) {
  try {
    const result = await service.createIssue(req.user._id, req.body);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 201, "Issue reported successfully", { issue: result.issue });
  } catch (error) {
    logger.error("Error creating issue report:", error);
    return sendErrorResponse(res, 500, "Failed to report issue");
  }
}

export async function getIssuesByPg(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const status = req.query.status || undefined;
    const result = await service.getIssuesByPg(req.params.pgId, req.user._id, { page, limit, status });
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 200, "Issues retrieved", {
      issues: result.issues,
      pagination: { page, limit, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching PG issues:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve issues");
  }
}

export async function getMyIssues(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const { issues, total } = await service.getMyIssues(req.user._id, { page, limit });
    return sendSuccessResponse(res, 200, "Your issues retrieved", {
      issues,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    logger.error("Error fetching user issues:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve issues");
  }
}

export async function getIssueById(req, res) {
  try {
    const result = await service.getIssueById(req.params.issueId);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 200, "Issue retrieved", { issue: result.issue });
  } catch (error) {
    logger.error("Error fetching issue:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve issue");
  }
}

export async function updateIssueStatus(req, res) {
  try {
    const result = await service.updateIssueStatus(req.params.issueId, req.user._id, req.body);
    if (result.error) {
      return sendErrorResponse(res, result.error.status, result.error.message);
    }
    return sendSuccessResponse(res, 200, "Issue updated", { issue: result.issue });
  } catch (error) {
    logger.error("Error updating issue:", error);
    return sendErrorResponse(res, 500, "Failed to update issue");
  }
}

export async function getPgIssueStats(req, res) {
  try {
    const stats = await service.getPgIssueStats(req.params.pgId);
    return sendSuccessResponse(res, 200, "PG issue stats", stats);
  } catch (error) {
    logger.error("Error fetching PG issue stats:", error);
    return sendErrorResponse(res, 500, "Failed to retrieve issue stats");
  }
}
