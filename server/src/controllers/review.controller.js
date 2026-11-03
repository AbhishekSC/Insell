// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/review/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.
export {
  createReview,
  getUserReviews,
} from "../modules/review/review.controller.js";
