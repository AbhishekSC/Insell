import mongoose from "mongoose";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import { logger } from "../../utils/logger.js";
import AppError from "../../exceptions/AppError.js";
import {
  normalizeFilters,
  filterKeyOf,
  describeFilters,
  toDTO,
} from "./savedSearch.dto.js";
import {
  listForUser,
  countForUser,
  upsert,
  updateById,
  removeById,
  candidatesForCity,
  markMatched,
} from "./savedSearch.repository.js";

const MAX_PER_USER = 12;
// Don't re-ping the same search more than once per window — protects against
// a bulk import blasting a watcher.
const NOTIFY_COOLDOWN_MS = 10 * 60 * 1000;

const eq = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Pure predicate — does this published post satisfy the saved search?
export function matchesPost(search, post) {
  const f = search.filters || {};
  if (f.postType?.length && !f.postType.includes(post.postType)) return false;
  if (f.city && !eq(f.city, post.city)) return false;
  if (f.locality && !eq(f.locality, post.locality)) return false;
  if (f.propertyType && !eq(f.propertyType, post.propertyType)) return false;
  if (f.minBedrooms && Number(post.bedrooms || 0) < f.minBedrooms) return false;
  const price = Number(post.price || 0);
  if (f.minPrice && price < f.minPrice) return false;
  if (f.maxPrice && price > 0 && price > f.maxPrice) return false;
  return true;
}

export async function listMySearches(userId) {
  return (await listForUser(userId)).map(toDTO);
}

export async function createSearch(userId, rawFilters, label) {
  const filters = normalizeFilters(rawFilters);
  const filterKey = filterKeyOf(filters);
  const existingCount = await countForUser(userId);
  if (existingCount >= MAX_PER_USER) {
    throw new AppError(`You can keep up to ${MAX_PER_USER} saved searches`, 400);
  }
  const doc = await upsert(userId, filters, filterKey, (label || "").trim() || describeFilters(filters));
  return toDTO(doc);
}

export async function updateSearch(userId, id, patch) {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Saved search not found", 404);
  const clean = {};
  if (typeof patch.active === "boolean") clean.active = patch.active;
  if (typeof patch.label === "string") clean.label = patch.label.trim().slice(0, 120);
  if (Object.keys(clean).length === 0) throw new AppError("Nothing to update", 400);
  const doc = await updateById(userId, id, clean);
  if (!doc) throw new AppError("Saved search not found", 404);
  return toDTO(doc);
}

export async function deleteSearch(userId, id) {
  if (!mongoose.isValidObjectId(id)) throw new AppError("Saved search not found", 404);
  await removeById(userId, id);
}

// Called (fire-and-forget) when a listing is published. Notifies the owner
// of every matching saved search, except the poster's own.
export async function notifyMatches(post) {
  try {
    if (!post || post.status !== "PUBLISHED" || post.visibility !== "PUBLIC") return;

    const candidates = await candidatesForCity(post.city);
    if (candidates.length === 0) return;

    const now = Date.now();
    const authorId = String(post.author?._id || post.author);
    const priceFmt = `₹${Number(post.price || 0).toLocaleString("en-IN")}`;
    const where = [post.locality, post.city].filter(Boolean).join(", ");

    const toNotify = candidates.filter((s) => {
      if (String(s.user) === authorId) return false;
      if (s.lastNotifiedAt && now - new Date(s.lastNotifiedAt).getTime() < NOTIFY_COOLDOWN_MS) return false;
      return matchesPost(s, post);
    });
    if (toNotify.length === 0) return;

    await Promise.allSettled(
      toNotify.map((s) =>
        NotificationService.send({
          recipientId: s.user,
          actorId: post.author?._id || post.author,
          type: "saved_search_match",
          title: `New match: ${s.label || describeFilters(s.filters)}`,
          message: `New listing matches your saved search — ${post.title}${where ? ` in ${where}` : ""} at ${priceFmt}`,
          data: { propertyPost: post._id, savedSearch: s._id },
          channels: [
            NotificationChannel.IN_APP,
            NotificationChannel.REALTIME,
            NotificationChannel.FIREBASE,
          ],
        })
      )
    );

    await markMatched(
      toNotify.map((s) => s._id),
      new Date()
    );
  } catch (error) {
    logger.error("savedSearch.notifyMatches failed (non-fatal):", error);
  }
}
