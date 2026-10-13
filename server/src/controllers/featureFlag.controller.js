import FeatureFlag from "../models/FeatureFlag.model.js";
import User from "../models/User.model.js";
import { evaluateFeatureFlag } from "../utils/featureFlagEvaluator.js";
import { logger } from "../utils/logger.js";

/**
 * GET /api/feature-flags/my-flags
 * Returns evaluated flags dictionary { [flagKey]: boolean } for the authenticated user.
 */
export const getMyEvaluatedFlags = async (req, res) => {
  try {
    const user = req.user;
    const flags = await FeatureFlag.find({ isActive: true }).lean();

    const evaluated = {};
    for (const flag of flags) {
      const result = evaluateFeatureFlag(flag, user);
      evaluated[flag.key] = result.enabled;
    }

    res.status(200).json({
      success: true,
      data: {
        flags: evaluated,
      },
    });
  } catch (error) {
    logger.error("Error evaluating user feature flags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to evaluate feature flags",
      error: error.message,
    });
  }
};

/**
 * GET /api/admin/feature-flags
 * Admin: List all feature flags with populated whitelisted users.
 */
export const adminListFeatureFlags = async (req, res) => {
  try {
    const flags = await FeatureFlag.find()
      .populate("enabledUserIds", "fullName email profilePic")
      .populate("disabledUserIds", "fullName email profilePic")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: {
        flags,
      },
    });
  } catch (error) {
    logger.error("Admin error listing feature flags:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load feature flags",
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/feature-flags
 * Admin: Create a new feature flag.
 */
export const adminCreateFeatureFlag = async (req, res) => {
  try {
    const { key, name, description, rolloutPercentage, enabledRoles, enabledUserIds, isActive } = req.body;

    if (!key || !name) {
      return res.status(400).json({
        success: false,
        message: "Key and name are required",
      });
    }

    const cleanKey = String(key).trim().toLowerCase();
    const existing = await FeatureFlag.findOne({ key: cleanKey });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A feature flag with key "${cleanKey}" already exists`,
      });
    }

    const flag = await FeatureFlag.create({
      key: cleanKey,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      rolloutPercentage: typeof rolloutPercentage === "number" ? Math.min(100, Math.max(0, rolloutPercentage)) : 0,
      enabledRoles: Array.isArray(enabledRoles) ? enabledRoles : [],
      enabledUserIds: Array.isArray(enabledUserIds) ? enabledUserIds : [],
      isActive: typeof isActive === "boolean" ? isActive : true,
    });

    const populated = await FeatureFlag.findById(flag._id)
      .populate("enabledUserIds", "fullName email profilePic")
      .populate("disabledUserIds", "fullName email profilePic");

    logger.info(`Admin created feature flag "${cleanKey}" with rollout ${flag.rolloutPercentage}%`);

    res.status(201).json({
      success: true,
      message: "Feature flag created successfully",
      data: { flag: populated },
    });
  } catch (error) {
    logger.error("Admin error creating feature flag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create feature flag",
      error: error.message,
    });
  }
};

/**
 * PATCH /api/admin/feature-flags/:id
 * Admin: Update rollout percentage, active state, or user whitelist/blacklist.
 */
export const adminUpdateFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, rolloutPercentage, isActive, enabledRoles, enabledUserIds, disabledUserIds } = req.body;

    const flag = await FeatureFlag.findById(id);
    if (!flag) {
      return res.status(404).json({
        success: false,
        message: "Feature flag not found",
      });
    }

    if (name !== undefined) flag.name = String(name).trim();
    if (description !== undefined) flag.description = String(description).trim();
    if (typeof rolloutPercentage === "number") {
      flag.rolloutPercentage = Math.min(100, Math.max(0, rolloutPercentage));
    }
    if (typeof isActive === "boolean") flag.isActive = isActive;
    if (Array.isArray(enabledRoles)) flag.enabledRoles = enabledRoles;
    if (Array.isArray(enabledUserIds)) flag.enabledUserIds = enabledUserIds;
    if (Array.isArray(disabledUserIds)) flag.disabledUserIds = disabledUserIds;

    await flag.save();

    const populated = await FeatureFlag.findById(flag._id)
      .populate("enabledUserIds", "fullName email profilePic")
      .populate("disabledUserIds", "fullName email profilePic");

    logger.info(`Admin updated feature flag "${flag.key}": rollout=${flag.rolloutPercentage}%, active=${flag.isActive}`);

    res.status(200).json({
      success: true,
      message: "Feature flag updated successfully",
      data: { flag: populated },
    });
  } catch (error) {
    logger.error("Admin error updating feature flag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update feature flag",
      error: error.message,
    });
  }
};

/**
 * DELETE /api/admin/feature-flags/:id
 * Admin: Delete a feature flag.
 */
export const adminDeleteFeatureFlag = async (req, res) => {
  try {
    const { id } = req.params;
    const flag = await FeatureFlag.findByIdAndDelete(id);

    if (!flag) {
      return res.status(404).json({
        success: false,
        message: "Feature flag not found",
      });
    }

    logger.info(`Admin deleted feature flag "${flag.key}"`);

    res.status(200).json({
      success: true,
      message: "Feature flag deleted successfully",
    });
  } catch (error) {
    logger.error("Admin error deleting feature flag:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete feature flag",
      error: error.message,
    });
  }
};

/**
 * POST /api/admin/feature-flags/:id/whitelist-user
 * Admin: Add a specific user by email or ID to the whitelist.
 */
export const adminAddUserToWhitelist = async (req, res) => {
  try {
    const { id } = req.params;
    const { userIdentifier } = req.body; // Can be email or userId

    if (!userIdentifier) {
      return res.status(400).json({ success: false, message: "User email or ID is required" });
    }

    const flag = await FeatureFlag.findById(id);
    if (!flag) {
      return res.status(404).json({ success: false, message: "Feature flag not found" });
    }

    const trimmed = String(userIdentifier).trim();
    const targetUser = await User.findOne({
      $or: [{ email: trimmed.toLowerCase() }, { _id: trimmed.match(/^[0-9a-fA-F]{24}$/) ? trimmed : null }],
    }).select("_id fullName email");

    if (!targetUser) {
      return res.status(404).json({ success: false, message: "User not found with provided email or ID" });
    }

    const alreadyWhitelisted = flag.enabledUserIds.some((uid) => String(uid) === String(targetUser._id));
    if (!alreadyWhitelisted) {
      flag.enabledUserIds.push(targetUser._id);
      await flag.save();
    }

    const populated = await FeatureFlag.findById(flag._id)
      .populate("enabledUserIds", "fullName email profilePic")
      .populate("disabledUserIds", "fullName email profilePic");

    res.status(200).json({
      success: true,
      message: `User ${targetUser.fullName} added to ${flag.name} whitelist`,
      data: { flag: populated },
    });
  } catch (error) {
    logger.error("Admin error adding user to flag whitelist:", error);
    res.status(500).json({
      success: false,
      message: "Failed to whitelist user",
      error: error.message,
    });
  }
};
