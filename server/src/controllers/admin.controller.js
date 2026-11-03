// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/admin/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.
export {
  getAdminUsers,
  toggleUserBlock,
  getAdminPosts,
  blockPost,
  unblockPost,
  getAdminReports,
  getAdminReportDetail,
  dismissPostReports,
  getAdminFeedback,
  resolveFeedback,
  uploadAnnouncementImageController,
  createAnnouncement,
  getAnnouncements,
  getLiveUsersCount,
  adminCreditCoins,
  adminGetUserWallet,
  adminGetCoinHistory,
  getAdminPropertyVerifications,
  reviewPropertyVerification,
  downloadPropertyBill,
} from "../modules/admin/admin.controller.js";
