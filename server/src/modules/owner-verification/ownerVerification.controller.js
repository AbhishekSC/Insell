import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import { getMyStatus, submitRequest, getQueue, review } from "./ownerVerification.service.js";
import AppError from "../../exceptions/AppError.js";

// GET /owner-verification/status
export const getStatus = asyncHandler(async (req, res) => {
  const request = await getMyStatus(req.user._id);
  return sendSuccessResponse(res, 200, "Verification status", {
    request,
    isOwnerVerified: Boolean(req.user.isOwnerVerified),
  });
});

// POST /owner-verification   (multipart: document)  body: { docType, note? }
export const submit = asyncHandler(async (req, res) => {
  const docUrl = req.file?.path || req.file?.secure_url;
  if (!docUrl) throw new AppError("A document upload is required", 400);
  const request = await submitRequest(req.user._id, {
    docType: req.body?.docType,
    docUrl,
    note: req.body?.note,
  });
  return sendSuccessResponse(res, 201, "Verification request submitted", { request });
});

// GET /owner-verification/admin/queue   (admin only)
export const adminQueue = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const result = await getQueue({ page, limit });
  return sendSuccessResponse(res, 200, "Pending verification requests", result);
});

// PATCH /owner-verification/admin/:id   body: { approve: boolean, reviewNote? }
export const adminReview = asyncHandler(async (req, res) => {
  const result = await review(req.params.id, {
    approve: Boolean(req.body?.approve),
    reviewNote: req.body?.reviewNote,
    reviewerId: req.user._id,
  });
  return sendSuccessResponse(res, 200, "Request reviewed", result);
});
