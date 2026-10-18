import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // SHA-256 hash of the refresh token secret string
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Optional device identifier (links to physical mobile device)
    deviceId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
    revoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    // Enables replay-attack detection during token rotation
    replacedByTokenHash: {
      type: String,
      default: null,
    },
    // When this token expires (default 90 days).
    // MongoDB TTL index automatically purges expired documents at this date.
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active tokens per user & device
refreshTokenSchema.index({ user: 1, revoked: 1, expiresAt: 1 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);

export default RefreshToken;
