import mongoose from "mongoose";

const mobileDetailSchema = new mongoose.Schema(
  {
    // The authenticated user who logged into or used this device (null if guest/pre-login)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },

    // Hardware or install identifier (unique per physical device installation)
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // Hardware specifications
    brand: {
      type: String,
      trim: true,
      default: "",
    },
    manufacturer: {
      type: String,
      trim: true,
      default: "",
    },
    modelName: {
      type: String,
      trim: true,
      default: "",
    },
    deviceType: {
      type: String,
      enum: ["PHONE", "TABLET", "DESKTOP", "UNKNOWN"],
      default: "PHONE",
    },
    isPhysicalDevice: {
      type: Boolean,
      default: true,
    },
    totalMemoryMB: {
      type: Number,
      default: null,
    },

    // Operating System
    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true,
      index: true,
    },
    osName: {
      type: String,
      trim: true,
      default: "",
    },
    osVersion: {
      type: String,
      trim: true,
      default: "",
    },
    osBuildId: {
      type: String,
      trim: true,
      default: "",
    },

    // App build and release
    appVersion: {
      type: String,
      trim: true,
      default: "1.0.0",
    },
    buildNumber: {
      type: String,
      trim: true,
      default: "1",
    },
    bundleId: {
      type: String,
      trim: true,
      default: "com.insell.app",
    },

    // Push notifications & push permission state
    pushToken: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    pushTokenType: {
      type: String,
      enum: ["fcm", "expo", "apns", null],
      default: "fcm",
    },
    pushPermissionStatus: {
      type: String,
      enum: ["granted", "denied", "undetermined"],
      default: "undetermined",
    },

    // Localization & network
    locale: {
      type: String,
      trim: true,
      default: "en-IN",
    },
    timezone: {
      type: String,
      trim: true,
      default: "Asia/Kolkata",
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },

    // Active session status
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: Fast lookup & upsert per user and physical device
mobileDetailSchema.index({ user: 1, deviceId: 1 }, { unique: true });

const MobileDetail = mongoose.model("MobileDetail", mobileDetailSchema);

export default MobileDetail;
