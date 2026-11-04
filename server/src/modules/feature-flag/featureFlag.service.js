import { evaluateFeatureFlag } from "../../utils/featureFlagEvaluator.js";
import { logger } from "../../utils/logger.js";
import * as featureFlagRepository from "./featureFlag.repository.js";

export const evaluateUserFlags = async (user) => {
  const flags = await featureFlagRepository.findActiveFlagsLean() || [];

  const evaluated = {};
  for (const flag of flags) {
    const result = evaluateFeatureFlag(flag, user);
    evaluated[flag.key] = result.enabled;
  }

  return evaluated;
};

export const listAllFlags = async () => {
  return featureFlagRepository.findAllFlagsPopulated();
};

export const createFeatureFlag = async ({ key, name, description, rolloutPercentage, enabledRoles, enabledUserIds, isActive }) => {
  if (!key || !name) {
    return { error: { status: 400, message: "Key and name are required" } };
  }

  const cleanKey = String(key).trim().toLowerCase();
  const existing = await featureFlagRepository.findFlagByKey(cleanKey);
  if (existing) {
    return { error: { status: 409, message: `A feature flag with key "${cleanKey}" already exists` } };
  }

  const flag = await featureFlagRepository.createFlag({
    key: cleanKey,
    name: String(name).trim(),
    description: description ? String(description).trim() : "",
    rolloutPercentage: typeof rolloutPercentage === "number" ? Math.min(100, Math.max(0, rolloutPercentage)) : 0,
    enabledRoles: Array.isArray(enabledRoles) ? enabledRoles : [],
    enabledUserIds: Array.isArray(enabledUserIds) ? enabledUserIds : [],
    isActive: typeof isActive === "boolean" ? isActive : true,
  });

  const populated = await featureFlagRepository.findFlagByIdPopulated(flag._id);

  logger.info(`Admin created feature flag "${cleanKey}" with rollout ${flag.rolloutPercentage}%`);

  return { flag: populated };
};

export const updateFeatureFlag = async (id, { name, description, rolloutPercentage, isActive, enabledRoles, enabledUserIds, disabledUserIds }) => {
  const flag = await featureFlagRepository.findFlagById(id);
  if (!flag) {
    return { error: { status: 404, message: "Feature flag not found" } };
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

  const populated = await featureFlagRepository.findFlagByIdPopulated(flag._id);

  logger.info(`Admin updated feature flag "${flag.key}": rollout=${flag.rolloutPercentage}%, active=${flag.isActive}`);

  return { flag: populated };
};

export const deleteFeatureFlag = async (id) => {
  const flag = await featureFlagRepository.deleteFlagById(id);

  if (!flag) {
    return { error: { status: 404, message: "Feature flag not found" } };
  }

  logger.info(`Admin deleted feature flag "${flag.key}"`);

  return { success: true };
};

export const addUserToWhitelist = async (id, userIdentifier) => {
  if (!userIdentifier) {
    return { error: { status: 400, message: "User email or ID is required" } };
  }

  const flag = await featureFlagRepository.findFlagById(id);
  if (!flag) {
    return { error: { status: 404, message: "Feature flag not found" } };
  }

  const trimmed = String(userIdentifier).trim();
  const targetUser = await featureFlagRepository.findUserByEmailOrId(trimmed);

  if (!targetUser) {
    return { error: { status: 404, message: "User not found with provided email or ID" } };
  }

  const alreadyWhitelisted = flag.enabledUserIds.some((uid) => String(uid) === String(targetUser._id));
  if (!alreadyWhitelisted) {
    flag.enabledUserIds.push(targetUser._id);
    await flag.save();
  }

  const populated = await featureFlagRepository.findFlagByIdPopulated(flag._id);

  return { flag: populated, targetUser };
};
