// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/advertisement/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.
export {
  calculateAdScore,
  balanceAdFeed,
  AD_COIN_PLANS,
  getActiveAdvertisements,
  recordImpression,
  recordClick,
  dismissAdvertisement,
  adminGetAdvertisements,
  adminCreateAdvertisement,
  adminUpdateAdvertisement,
  adminDeleteAdvertisement,
  uploadAdvertisementImageController,
  createAdvertisementWithCoins,
  getMyCampaigns,
  toggleMyCampaignStatus,
} from "../modules/advertisement/advertisement.controller.js";
