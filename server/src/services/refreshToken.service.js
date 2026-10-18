import crypto from "crypto";
import RefreshToken from "../models/RefreshToken.model.js";
import User from "../models/User.model.js";
import { issueAccessToken, hashToken } from "../utils/jwt.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import { logger } from "../utils/logger.js";
import AppError from "../exceptions/AppError.js";

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// Default refresh token expiry: 90 days (in milliseconds)
const REFRESH_TOKEN_EXPIRY_DAYS = 90;
const REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

export function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: "/",
  };
}

/**
 * Creates and persists a new refresh token for a user.
 */
export async function createRefreshToken({ userId, deviceId = null, userAgent = "", ipAddress = "", res = null }) {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  await RefreshToken.create({
    user: userId,
    tokenHash,
    deviceId: deviceId ? String(deviceId).trim() : null,
    userAgent: userAgent ? String(userAgent).substring(0, 500) : "",
    ipAddress: ipAddress ? String(ipAddress).substring(0, 100) : "",
    expiresAt,
  });

  if (res && typeof res.cookie === "function") {
    res.cookie("syncspace_refresh_token", rawToken, getRefreshTokenCookieOptions());
  }

  return rawToken;
}

/**
 * Rotates an existing refresh token:
 * Validates the old token, issues a new access token + new refresh token,
 * marks the old refresh token as revoked, and detects replay attacks.
 */
export async function rotateRefreshToken({ rawRefreshToken, deviceId = null, userAgent = "", ipAddress = "", res = null }) {
  if (!rawRefreshToken || typeof rawRefreshToken !== "string" || !rawRefreshToken.trim()) {
    throw new AppError("Refresh token is required", 400);
  }

  const cleanRawToken = rawRefreshToken.trim();
  const tokenHash = hashToken(cleanRawToken);

  const existingTokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!existingTokenDoc) {
    logger.warn("Refresh token rotation failed: Token not found in database");
    throw new AppError("Invalid or expired refresh token", 401);
  }

  // **Replay Attack Detection**:
  // If a revoked refresh token is presented, someone may be attempting a replay attack.
  // For security, revoke all active sessions for this user.
  if (existingTokenDoc.revoked) {
    logger.error(`Replay attack detected for user ${existingTokenDoc.user}. Revoking all tokens.`, {
      userId: existingTokenDoc.user,
      tokenId: existingTokenDoc._id,
    });
    await RefreshToken.updateMany(
      { user: existingTokenDoc.user, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
    throw new AppError("Invalid or compromised refresh token. Please sign in again.", 401);
  }

  // Check if expired
  if (existingTokenDoc.expiresAt < new Date()) {
    existingTokenDoc.revoked = true;
    existingTokenDoc.revokedAt = new Date();
    await existingTokenDoc.save();
    throw new AppError("Refresh token expired. Please sign in again.", 401);
  }

  // Verify the user exists and is active
  const user = await User.findById(existingTokenDoc.user);
  if (!user) {
    throw new AppError("User account not found", 401);
  }

  if (user.isBlocked) {
    throw new AppError("Your account has been blocked. Contact support for help.", 403, {
      code: "ACCOUNT_BLOCKED",
    });
  }

  // Issue new tokens
  const newAccessToken = issueAccessToken(user, res);
  const newRawRefreshToken = crypto.randomBytes(40).toString("hex");
  const newTokenHash = hashToken(newRawRefreshToken);
  const newExpiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS);

  // Invalidate old token & link to the new token
  existingTokenDoc.revoked = true;
  existingTokenDoc.revokedAt = new Date();
  existingTokenDoc.replacedByTokenHash = newTokenHash;
  await existingTokenDoc.save();

  // Create new active token document
  await RefreshToken.create({
    user: user._id,
    tokenHash: newTokenHash,
    deviceId: deviceId || existingTokenDoc.deviceId || null,
    userAgent: userAgent ? String(userAgent).substring(0, 500) : existingTokenDoc.userAgent,
    ipAddress: ipAddress ? String(ipAddress).substring(0, 100) : existingTokenDoc.ipAddress,
    expiresAt: newExpiresAt,
  });

  if (res && typeof res.cookie === "function") {
    res.cookie("syncspace_refresh_token", newRawRefreshToken, getRefreshTokenCookieOptions());
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRawRefreshToken,
    token: newAccessToken, // Backwards compatibility for callers expecting `token`
    user: sanitizeUserData(user),
  };
}

/**
 * Revokes a single refresh token (e.g. on logout).
 */
export async function revokeRefreshToken({ rawRefreshToken, res = null }) {
  if (rawRefreshToken && typeof rawRefreshToken === "string") {
    const tokenHash = hashToken(rawRefreshToken.trim());
    await RefreshToken.updateOne(
      { tokenHash, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } }
    );
  }

  if (res && typeof res.clearCookie === "function") {
    res.clearCookie("syncspace_refresh_token", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      path: "/",
    });
  }
}

/**
 * Revokes all refresh tokens for a user (e.g. on password reset or account security event).
 */
export async function revokeAllUserRefreshTokens(userId) {
  if (!userId) return;
  await RefreshToken.updateMany(
    { user: userId, revoked: false },
    { $set: { revoked: true, revokedAt: new Date() } }
  );
}
