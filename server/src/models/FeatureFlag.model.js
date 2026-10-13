import mongoose from "mongoose";

const featureFlagSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Feature flag key is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_-]+$/, "Key can only contain lowercase alphanumeric, underscores, and dashes"],
    },
    name: {
      type: String,
      required: [true, "Feature flag name is required"],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    rolloutPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    // Whitelist specific user IDs who always get the feature even at 0%
    enabledUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Blacklist specific user IDs who never get the feature even at 100%
    disabledUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Specific roles eligible for this rollout (empty array means all roles are eligible)
    enabledRoles: [
      {
        type: String,
        trim: true,
      },
    ],
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

featureFlagSchema.index({ isActive: 1 });

const FeatureFlag = mongoose.model("FeatureFlag", featureFlagSchema);

export default FeatureFlag;
