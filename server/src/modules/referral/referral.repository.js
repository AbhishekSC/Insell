import Referral from "../../models/Referral.model.js";
import User from "../../models/User.model.js";

export async function findUserByCode(code) {
  if (!code) return null;
  return User.findOne({ referralCode: code }).select("_id fullName referralCode").lean();
}

export async function findUserByEmailOrId(idOrEmail) {
  return User.findById(idOrEmail).select("referralCode referredBy referralCredits").lean();
}

export async function setReferralCode(userId, code) {
  await User.updateOne({ _id: userId }, { $set: { referralCode: code } });
}

export async function setReferredBy(userId, referrerId) {
  await User.updateOne(
    { _id: userId, referredBy: null },
    { $set: { referredBy: referrerId } }
  );
}

export async function createReferralRecord(referrerId, referredId) {
  // One row per referred user — a user can only ever have been referred
  // once, enforced by the unique index on `referred`.
  try {
    return await Referral.create({ referrer: referrerId, referred: referredId, status: "PENDING" });
  } catch (err) {
    if (err?.code === 11000) return null; // already recorded — not an error
    throw err;
  }
}

export async function markRewarded(referredId) {
  return Referral.findOneAndUpdate(
    { referred: referredId, status: "PENDING" },
    { $set: { status: "REWARDED", rewardedAt: new Date() } },
    { new: true }
  );
}

export async function incrementCredits(userId, amount) {
  await User.updateOne({ _id: userId }, { $inc: { referralCredits: amount } });
}

export async function countSuccessfulReferrals(userId) {
  return Referral.countDocuments({ referrer: userId, status: "REWARDED" });
}
