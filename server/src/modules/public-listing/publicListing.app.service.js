import mongoose from "mongoose";
import AppError from "../../exceptions/AppError.js";
import { toSharePreviewDTO } from "./publicListing.dto.js";
import { findShareableById, incrementShareCount } from "./publicListing.repository.js";

function assertValidId(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError("Listing not found", 404);
  }
}

// Public, no-auth preview of a single listing — used by the /p/:id share
// page and its link-unfurl (Open Graph) metadata.
export async function getSharePreview(id) {
  assertValidId(id);
  const post = await findShareableById(id);
  if (!post) {
    throw new AppError("Listing not found", 404);
  }
  return toSharePreviewDTO(post);
}

// Best-effort share counter bump. Never blocks the caller.
export async function recordShare(id) {
  if (!id || !mongoose.isValidObjectId(id)) return;
  try {
    await incrementShareCount(id);
  } catch {
    // counter is non-critical
  }
}
