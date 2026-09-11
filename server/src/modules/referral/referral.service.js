import crypto from "crypto";
import User from "../../models/User.model.js";
import { logger } from "../../utils/logger.js";
import * as NotificationService from "../../services/NotificationService.js";
import { NotificationChannel } from "../../services/NotificationService.js";
import {
  findUserByCode,
  findUserByEmailOrId,
  setReferralCode,
  setReferredBy,
  createReferralRecord,
  markRewarded,
  incrementCredits,
  countSuccessfulReferrals,
} from "./referral.repository.js";

const REWARD_CREDITS = 1;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — avoids look-alike confusion when read aloud/typed

function randomCode(length = 7) {
  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

// Codes are generated lazily (first time they're needed) rather than for
// every user at signup, so existing accounts don't need a migration.
export async function ensureReferralCode(userId) {
  const user = await findUserByEmailOrId(userId);
  if (user?.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    try {
      await setReferralCode(userId, code);
      return code;
    } catch (err) {
      if (err?.code !== 11000) throw err; // collision on the unique index — retry with a fresh code
    }
  }
  throw new Error("Could not generate a unique referral code");
}

export async function getMyReferralInfo(userId) {
  const code = await ensureReferralCode(userId);
  const credits = (await findUserByEmailOrId(userId))?.referralCredits || 0;
  const successfulReferrals = await countSuccessfulReferrals(userId);
  const clientUrl = process.env.CLIENT_URL || "https://nearmyspace.app";
  return {
    code,
    link: `${clientUrl}/signup?ref=${code}`,
    credits,
    successfulReferrals,
  };
}

// Called once, right after a referred signup creates its User row (see
// AuthService.verifySignup) — resolves the code to a referrer and records
// the relationship. Reward itself is deferred to email verification
// (rewardIfEligible), not this call, so a throwaway/never-verified signup
// never pays out.
export async function attachReferrerFromCode(newUserId, referralCode) {
  if (!referralCode) return;
  try {
    const referrer = await findUserByCode(referralCode);
    if (!referrer || String(referrer._id) === String(newUserId)) return; // no self-referral
    await setReferredBy(newUserId, referrer._id);
    await createReferralRecord(referrer._id, newUserId);
  } catch (error) {
    logger.error("referral.attachReferrerFromCode failed (non-fatal):", error);
  }
}

// Called when a referred user's email gets verified — the "qualifying
// action" that turns a pending referral into a real one. Rewards both
// sides once; markRewarded's PENDING-only filter makes this idempotent if
// verification somehow runs twice.
export async function rewardIfEligible(userId) {
  try {
    const user = await User.findById(userId).select("referredBy fullName").lean();
    if (!user?.referredBy) return;

    const referral = await markRewarded(userId);
    if (!referral) return; // already rewarded, or was never a real referral

    await Promise.all([
      incrementCredits(referral.referrer, REWARD_CREDITS),
      incrementCredits(userId, REWARD_CREDITS),
    ]);

    await NotificationService.send({
      recipientId: referral.referrer,
      actorId: userId,
      type: "referral_reward",
      title: "Referral reward earned 🎉",
      message: `${user.fullName || "Someone you invited"} joined NearMySpace — you both earned a listing-boost credit.`,
      channels: [NotificationChannel.IN_APP, NotificationChannel.REALTIME, NotificationChannel.FIREBASE],
    }).catch(() => {});
  } catch (error) {
    logger.error("referral.rewardIfEligible failed (non-fatal):", error);
  }
}
