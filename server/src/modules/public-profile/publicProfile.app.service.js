import mongoose from "mongoose";
import AppError from "../../exceptions/AppError.js";
import { toPublicProfileDTO } from "./publicProfile.dto.js";
import {
  findPublicUser,
  listPublicPosts,
  countPublicPosts,
  relatedProfiles,
} from "./publicProfile.repository.js";

const PREVIEW_POST_COUNT = 5;
const RELATED_COUNT = 6;

// Public, no-auth snapshot of a member's profile — used by the logged-out
// profile page and its link-unfurl. Shows the header, the first few
// listings, and a handful of related members. Everything else is gated
// behind sign-in on the client.
export async function getPublicProfile(id) {
  if (!id || !mongoose.isValidObjectId(id)) {
    throw new AppError("Profile not found", 404);
  }
  const user = await findPublicUser(id);
  if (!user) {
    throw new AppError("Profile not found", 404);
  }

  const [previewPosts, postsCount, related] = await Promise.all([
    listPublicPosts(user._id, PREVIEW_POST_COUNT),
    countPublicPosts(user._id),
    relatedProfiles(user, RELATED_COUNT),
  ]);

  return toPublicProfileDTO(user, { postsCount, previewPosts, related });
}
