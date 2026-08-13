import jwt from "jsonwebtoken";
import crypto from "crypto";
import { logger } from "./logger.js";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
  if (!secret) {
    logger.warn("JWT_SECRET not set, generating process-local fallback secret");
    return crypto.randomBytes(64).toString("hex");
  }
  return secret;
}

function getTokenExpiry() {
  const value = process.env.JWT_EXPIRES_IN || "4h";
  if (!value || typeof value !== "string") return "4h";
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) return Number(normalized);
  if (/^\d+\s*(ms|s|m|h|d|w|y)$/i.test(normalized)) return normalized.replace(/\s+/g, "");
  return "4h";
}

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

export function issueAccessToken(user, res) {
  const payload = {
    id: user._id,
    fullName: user.fullName,
    profilePic: user.profilePic,
  };

  const accessToken = jwt.sign(payload, getJwtSecret(), {
    expiresIn: getTokenExpiry(),
    algorithm: "HS256",
  });

  res.cookie("syncspace_token", accessToken, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
    maxAge: 1000 * 60 * 60 * 24,
  });

  return accessToken;
}

