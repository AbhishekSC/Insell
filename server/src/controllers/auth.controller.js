// ─── Backward-compatible re-export shim ────────────────────────────────
// All business logic has moved to server/src/modules/auth/.
// This file re-exports every public symbol so existing import paths
// (routes, workers, other controllers) continue to work unchanged.
// New code should import directly from the module.
export {
  signup,
  verifySignup,
  resendSignupCode,
  login,
  refresh,
  logout,
  logoutAll,
  onboarding,
  googleAuth,
  googleAuthCallback,
  requestPasswordReset,
  verifyResetOTP,
  resetPassword,
  requestLoginOTP,
  verifyLoginOTP,
} from "../modules/auth/auth.controller.js";
