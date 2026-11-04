import FeatureFlag from "../../models/FeatureFlag.model.js";
import User from "../../models/User.model.js";

export const findActiveFlagsLean = () => {
  return FeatureFlag.find({ isActive: true }).lean();
};

export const findAllFlagsPopulated = () => {
  return FeatureFlag.find()
    .populate("enabledUserIds", "fullName email profilePic")
    .populate("disabledUserIds", "fullName email profilePic")
    .sort({ createdAt: -1 })
    .lean();
};

export const findFlagByKey = (key) => {
  return FeatureFlag.findOne({ key }).lean();
};

export const createFlag = (data) => {
  return FeatureFlag.create(data);
};

export const findFlagByIdPopulated = (id) => {
  return FeatureFlag.findById(id)
    .populate("enabledUserIds", "fullName email profilePic")
    .populate("disabledUserIds", "fullName email profilePic")
    .lean();
};

export const findFlagById = (id) => {
  return FeatureFlag.findById(id);
};

export const deleteFlagById = (id) => {
  return FeatureFlag.findByIdAndDelete(id);
};

export const findUserByEmailOrId = (trimmed) => {
  return User.findOne({
    $or: [{ email: trimmed.toLowerCase() }, { _id: trimmed.match(/^[0-9a-fA-F]{24}$/) ? trimmed : null }],
  }).select("_id fullName email").lean();
};
