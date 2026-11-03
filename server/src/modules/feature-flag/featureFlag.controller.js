import { logger } from "../../utils/logger.js";
import * as featureFlagService from "./featureFlag.service.js";

/**
 * GET /api/feature-flags/my-flags
 * Returns evaluated flags dictionary { [flagKey]: boolean } for the authenticated user.
 */
export const getMyEvaluatedFlags = async (req, res) => {
  try {
    const user = req.user;
    const evaluated = await featureFlagService.evaluateUserFlags(user);

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
    const flags = await featureFlagService.listAllFlags();

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

    const result = await featureFlagService.createFeatureFlag({ key, name, description, rolloutPercentage, enabledRoles, enabledUserIds, isActive });

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    res.status(201).json({
      success: true,
      message: "Feature flag created successfully",
      data: { flag: result.flag },
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

    const result = await featureFlagService.updateFeatureFlag(id, { name, description, rolloutPercentage, isActive, enabledRoles, enabledUserIds, disabledUserIds });

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    res.status(200).json({
      success: true,
      message: "Feature flag updated successfully",
      data: { flag: result.flag },
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

    const result = await featureFlagService.deleteFeatureFlag(id);

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

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

    const result = await featureFlagService.addUserToWhitelist(id, userIdentifier);

    if (result.error) {
      return res.status(result.error.status).json({ success: false, message: result.error.message });
    }

    res.status(200).json({
      success: true,
      message: `User ${result.targetUser.fullName} added to ${result.flag.name} whitelist`,
      data: { flag: result.flag },
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
