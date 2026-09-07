import mongoose from "mongoose";
import AppError from "../../exceptions/AppError.js";
import { toSharePreviewDTO, toPublicDetailDTO } from "./publicListing.dto.js";
import {
  findShareableById,
  findPublicDetailById,
  findRelatedListings,
  incrementShareCount,
} from "./publicListing.repository.js";
import { relatedProfiles } from "../public-profile/publicProfile.repository.js";

const RELATED_COUNT = 8;
const RELATED_PROFILE_COUNT = 8;

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

// Fuller public view of one listing — used by the logged-out property page.
export async function getPublicListingDetail(id) {
  assertValidId(id);
  const post = await findPublicDetailById(id);
  if (!post) {
    throw new AppError("Listing not found", 404);
  }
  const [related, people] = await Promise.all([
    findRelatedListings(post, RELATED_COUNT),
    post.author?._id
      ? relatedProfiles({ _id: post.author._id, city: post.author.city || post.city }, RELATED_PROFILE_COUNT)
      : Promise.resolve([]),
  ]);
  return toPublicDetailDTO(post, related, people);
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
