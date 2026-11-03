// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/property-post/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.

export {
  getPropertyAnalytics,
  compareProperties,
  getLatestFeedPost,
  getPropertyFeed,
  createPropertyPost,
  updatePropertyPost,
  deletePropertyPost,
  togglePropertyPostLike,
  togglePropertyPostSave,
  boostPropertyPost,
  expireBoostedPostsSweep,
  getMyPropertyPosts,
  getPropertyPostById,
  getPostLikers,
  getSimilarProperties,
  getPriceInsight,
  getPropertyValuation,
  getCardSignals,
  getPriceSuggestion,
  incrementViewCount,
  getPropertyMediaUploadSignature,
  uploadPropertyMedia,
  reportPost,
  getHotPropertiesFeed,
  recordMicroEngagement,
  recordCoverClick,
  getMapPins,
  // Functions consumed by workers / other services
  sanitizePriceHistory,
  handlePriceChangeFanout,
  notifyPriceChange,
  notifyActiveOfferBuyersOfPriceChange,
  getUserReportedPostIds,
  getUserSocialGraph,
  invalidateUserSocialGraph,
  batchDecoratePosts,
} from "../modules/property-post/propertyPost.controller.js";
