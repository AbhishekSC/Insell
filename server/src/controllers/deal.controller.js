// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/deal/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.
export {
  ensureDealForOffer,
  getMyDeals,
  getDealForPost,
  updateDeal,
  getDealStats,
  adminListDeals,
  adminResolveDealReports,
  adminForceCancelDeal,
  addDealAttachment,
  verifyDealAttachment,
  getDealSummary,
  removeDealAttachment,
  nudgeStalledDeals,
  verifyPublicClosingStatement,
} from "../modules/deal/deal.controller.js";
