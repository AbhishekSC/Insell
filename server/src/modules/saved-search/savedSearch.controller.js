import { asyncHandler } from "../../core/asyncHandler.js";
import { sendSuccessResponse } from "../../utils/responseHandler.js";
import {
  listMySearches,
  createSearch,
  updateSearch,
  deleteSearch,
} from "./savedSearch.app.service.js";

// GET /api/saved-searches
export const getMine = asyncHandler(async (req, res) => {
  const searches = await listMySearches(req.user._id);
  return sendSuccessResponse(res, 200, "Saved searches", { searches });
});

// POST /api/saved-searches   body: { filters, label? }
export const create = asyncHandler(async (req, res) => {
  const search = await createSearch(req.user._id, req.body?.filters || {}, req.body?.label);
  return sendSuccessResponse(res, 201, "Search saved", { search });
});

// PATCH /api/saved-searches/:id   body: { active?, label? }
export const update = asyncHandler(async (req, res) => {
  const search = await updateSearch(req.user._id, req.params.id, req.body || {});
  return sendSuccessResponse(res, 200, "Saved search updated", { search });
});

// DELETE /api/saved-searches/:id
export const remove = asyncHandler(async (req, res) => {
  await deleteSearch(req.user._id, req.params.id);
  return sendSuccessResponse(res, 200, "Saved search removed", {});
});
