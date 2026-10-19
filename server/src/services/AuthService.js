import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import BaseService from "./BaseService.js";
import AppError from "../exceptions/AppError.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import { SCHEMA_CONSTANTS } from "../utils/constants.js";
import PendingSignup from "../models/PendingSignup.model.js";
import User from "../models/User.model.js";
import { generateVerificationCode, VERIFICATION_CODE_EXPIRY_MINUTES } from "./VerificationService.js";
import { sendVerificationEmail, sendWelcomeEmail } from "./EmailService.js";
import { logger } from "../utils/logger.js";
import Notification from "../models/Notification.model.js";
import { pushRealtimeNotification } from "./stream.service.js";
import { attachReferrerFromCode, rewardIfEligible } from "../modules/referral/referral.service.js";
import { createRefreshToken, revokeRefreshToken } from "./refreshToken.service.js";
import { creditCoins } from "./wallet.service.js";
import { invalidateUserProfileCache } from "./likeCache.service.js";

const { BCRYPT_SALT_ROUNDS, PASSWORD_MIN_LENGTH } = SCHEMA_CONSTANTS;

// At least PASSWORD_MIN_LENGTH chars, one uppercase letter, one special
// character — mirrored on the client (SignupPage.jsx) for instant feedback,
// but enforced here too since the client check alone doesn't stop a direct
// API call with a weak password.
const PASSWORD_STRENGTH_REGEX = new RegExp(
  `^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>_\\-+=~\`[\\]\\\\/;']).{${PASSWORD_MIN_LENGTH},}$`
);
const PASSWORD_STRENGTH_MESSAGE =
  `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include one uppercase letter and one special character.`;

export { PASSWORD_STRENGTH_REGEX, PASSWORD_STRENGTH_MESSAGE };

const WELCOME_MESSAGE = "🚀 New to NearMySpace? Explore, connect, and discover what's waiting for you!";
const WELCOME_DELAY_MS = 15 * 1000;

// Fired once per new account, ~15s after signup (which also logs the user
// in immediately, so this is effectively their first-login moment) — long
// enough that it doesn't slam a popup on top of the very first paint, but
// while they're still in that first session. Delivered through the same
// Notification pipeline as an admin-sent announcement (must-dismiss modal,
// realtime push), so it reuses AnnouncementNotice.jsx with no client changes.
function scheduleWelcomeAnnouncement(userId) {
  setTimeout(() => {
    Notification.create({
      recipient: userId,
      type: "admin_announcement",
      message: WELCOME_MESSAGE,
    })
      .then(() => pushRealtimeNotification(userId, "admin_announcement"))
      .catch((error) => {
        logger.error("Failed to create welcome announcement (non-fatal):", { userId: String(userId), error: error.message });
      });
  }, WELCOME_DELAY_MS);
}

export default class AuthService extends BaseService {
  constructor({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService }) {
    super({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService });
  }

  // Signup no longer creates a User row — it stages the attempt in
  // PendingSignup and emails an OTP. The real account is only created once
  // that code is verified (see verifySignup below), so an abandoned signup
  // never leaves a permanently-unverified, unusable User behind — it just
  // expires via PendingSignup's TTL index instead.
  async signup({ fullName, email, password, referralCode }) {
    const { userRepository } = this.dependencies;
    const cleanEmail = String(email || "").trim().toLowerCase();

    const existingUser = await userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      throw new AppError("Email already exists. Please use a different email.", 400);
    }

    if (!PASSWORD_STRENGTH_REGEX.test(password)) {
      throw new AppError(PASSWORD_STRENGTH_MESSAGE, 400);
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(BCRYPT_SALT_ROUNDS));
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    // Re-attempting a signup with the same (still-unverified) email refreshes
    // the pending record. Preserve any active unexpired code in recentVerificationCodes
    // so an email in transit can still be verified without "invalid code" errors.
    const cleanReferralCode = String(referralCode || "").trim().toUpperCase() || undefined;
    const existingPending = await PendingSignup.findOne({ email: cleanEmail });
    const now = new Date();
    const recentCodes = [];

    if (existingPending) {
      if (existingPending.verificationCode && existingPending.verificationCodeExpires && new Date(existingPending.verificationCodeExpires) > now) {
        recentCodes.push({
          code: String(existingPending.verificationCode).trim(),
          expiresAt: existingPending.verificationCodeExpires,
        });
      }
      if (Array.isArray(existingPending.recentVerificationCodes)) {
        for (const item of existingPending.recentVerificationCodes) {
          if (item?.code && item?.expiresAt && new Date(item.expiresAt) > now) {
            recentCodes.push({
              code: String(item.code).trim(),
              expiresAt: new Date(item.expiresAt),
            });
          }
        }
      }
    }

    const pendingSignup = await PendingSignup.findOneAndUpdate(
      { email: cleanEmail },
      {
        fullName: String(fullName || "").trim(),
        email: cleanEmail,
        password: hashedPassword,
        verificationCode,
        verificationCodeExpires,
        recentVerificationCodes: recentCodes.slice(-5),
        ...(cleanReferralCode ? { referralCode: cleanReferralCode } : {}),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
      await sendVerificationEmail(pendingSignup.email, verificationCode, pendingSignup.fullName);
    } catch (error) {
      logger.error("Failed to send signup verification email:", error);
      logger.info(`Verification code for ${cleanEmail}: ${verificationCode}`);
    }

    return { email: pendingSignup.email, expiresAt: verificationCodeExpires };
  }

  // Promotes a verified PendingSignup into a real User — this is the only
  // point at which a signup actually creates a DB row and a login session.
  async verifySignup({ email, code, res, ...options }) {
    const { userRepository, tokenIssuer, streamUpdater, queuePublisher } = this.dependencies;
    const cleanEmail = String(email || "").trim().toLowerCase();
    const cleanCode = String(code || "").trim();

    if (!cleanCode) {
      throw new AppError("Verification code is required", 400);
    }

    const pendingSignup = await PendingSignup.findOne({ email: cleanEmail });
    if (!pendingSignup) {
      throw new AppError("No pending signup found for this email. Please sign up again.", 404);
    }

    if ((pendingSignup.verificationAttempts || 0) >= 5) {
      throw new AppError("Too many failed verification attempts. Please request a new code.", 429);
    }

    const now = new Date();

    // Check primary code and any active recent codes from recent resends
    const isPrimaryMatch =
      String(pendingSignup.verificationCode).trim() === cleanCode &&
      pendingSignup.verificationCodeExpires &&
      new Date(pendingSignup.verificationCodeExpires) > now;

    const isRecentMatch =
      Array.isArray(pendingSignup.recentVerificationCodes) &&
      pendingSignup.recentVerificationCodes.some(
        (entry) => String(entry?.code).trim() === cleanCode && entry?.expiresAt && new Date(entry.expiresAt) > now
      );

    const isMatch = isPrimaryMatch || isRecentMatch;

    if (!isMatch) {
      pendingSignup.verificationAttempts = (pendingSignup.verificationAttempts || 0) + 1;
      await pendingSignup.save().catch(() => {});
      const remaining = Math.max(0, 5 - pendingSignup.verificationAttempts);

      // Check if it was a previously valid code that expired
      const isExpired =
        (String(pendingSignup.verificationCode).trim() === cleanCode && new Date(pendingSignup.verificationCodeExpires) <= now) ||
        (Array.isArray(pendingSignup.recentVerificationCodes) &&
          pendingSignup.recentVerificationCodes.some(
            (entry) => String(entry?.code).trim() === cleanCode && new Date(entry.expiresAt) <= now
          ));

      if (isExpired) {
        throw new AppError(`Verification code has expired. Please request a new one. (${remaining} attempts remaining)`, 400);
      }

      throw new AppError(`Invalid verification code. (${remaining} attempts remaining)`, 400);
    }

    const existingUser = await userRepository.findByEmail(cleanEmail);
    if (existingUser) {
      // Someone else finished signing up with this email in the meantime
      // (e.g. two tabs). Clean up the now-redundant pending record instead
      // of failing with a confusing duplicate-key error.
      await PendingSignup.deleteOne({ _id: pendingSignup._id });
      throw new AppError("Email already exists. Please use a different email.", 400);
    }

    // pendingSignup.password is already bcrypt-hashed (see signup above) —
    // the User model's pre-save hook recognizes that and skips re-hashing.
    const newUser = await userRepository.create({
      fullName: pendingSignup.fullName,
      email: pendingSignup.email,
      password: pendingSignup.password,
      profilePic: "",
      isVerified: true,
    });

    await PendingSignup.deleteOne({ _id: pendingSignup._id });

    // Welcome bonus: every new user starts with 250 coins.
    try {
      await creditCoins({
        userId: newUser._id,
        amount: 250,
        category: "SIGNUP_BONUS",
        description: "Welcome bonus for joining NearMySpace!",
      });
      await Notification.create({
        recipient: newUser._id,
        type: "coin_bonus",
        title: "Welcome bonus! 🎉",
        message: "You've received 250 coins as a welcome bonus. Use them to boost your listings!",
      }).catch(() => {});
      pushRealtimeNotification(newUser._id.toString(), "coin_bonus").catch(() => {});
    } catch (err) {
      logger.error("Failed to credit signup bonus:", err?.message);
    }

    // Referral: attach the referrer (if this signup came in via ?ref=CODE),
    // then reward both sides immediately — this whole flow only creates the
    // User row once its OTP is already verified, so "signed up" and
    // "verified" are the same moment here.
    if (pendingSignup.referralCode) {
      await attachReferrerFromCode(newUser._id, pendingSignup.referralCode);
      await rewardIfEligible(newUser._id);
    }

    const accessToken = tokenIssuer(newUser, res);
    let refreshToken = null;
    try {
      refreshToken = await createRefreshToken({
        userId: newUser._id,
        deviceId: options?.deviceId || null,
        userAgent: options?.userAgent || "",
        ipAddress: options?.ipAddress || "",
        res,
      });
    } catch (error) {
      logger.error("Failed to create refresh token during signup verification:", error);
    }

    try {
      await streamUpdater({
        id: newUser._id.toString(),
        name: newUser.fullName,
        image: newUser.profilePic || "",
      });
    } catch {
      // Stream sync failures should not block auth flow.
    }

    try {
      queuePublisher({ event: "user_logged_in", email: newUser.email, name: newUser.fullName });
    } catch {
      // Queue failures should not block auth flow.
    }

    try {
      await sendWelcomeEmail(newUser.email, newUser.fullName);
    } catch (error) {
      logger.error("Failed to send welcome email:", error);
    }

    scheduleWelcomeAnnouncement(newUser._id);

    // Cookie auth is unreliable cross-site (Safari blocks third-party
    // cookies by default) — also hand the token back in the body so the
    // client can send it as an Authorization header instead.
    return {
      ...sanitizeUserData(newUser),
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  // Resends a fresh OTP for a still-pending (not yet verified) signup.
  async resendSignupCode({ email }) {
    const cleanEmail = String(email || "").trim().toLowerCase();
    const pendingSignup = await PendingSignup.findOne({ email: cleanEmail });
    if (!pendingSignup) {
      throw new AppError("No pending signup found for this email. Please sign up again.", 404);
    }

    const now = new Date();
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    // Keep current verification code in recentVerificationCodes so if the previous
    // email arrives, the user's attempt doesn't fail with "invalid code".
    const recentCodes = [];
    if (pendingSignup.verificationCode && pendingSignup.verificationCodeExpires && new Date(pendingSignup.verificationCodeExpires) > now) {
      recentCodes.push({
        code: String(pendingSignup.verificationCode).trim(),
        expiresAt: pendingSignup.verificationCodeExpires,
      });
    }
    if (Array.isArray(pendingSignup.recentVerificationCodes)) {
      for (const item of pendingSignup.recentVerificationCodes) {
        if (item?.code && item?.expiresAt && new Date(item.expiresAt) > now) {
          recentCodes.push({
            code: String(item.code).trim(),
            expiresAt: new Date(item.expiresAt),
          });
        }
      }
    }

    pendingSignup.verificationCode = verificationCode;
    pendingSignup.verificationCodeExpires = verificationCodeExpires;
    pendingSignup.recentVerificationCodes = recentCodes.slice(-5);
    await pendingSignup.save();

    try {
      await sendVerificationEmail(pendingSignup.email, verificationCode, pendingSignup.fullName);
    } catch (error) {
      logger.error("Failed to send signup verification email:", error);
      logger.info(`Verification code for ${cleanEmail}: ${verificationCode}`);
    }

    return { email: pendingSignup.email, expiresAt: verificationCodeExpires };
  }

  async login({ email, password, res, ...options }) {
    const { userRepository, tokenIssuer, queuePublisher } = this.dependencies;

    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new AppError("Invalid credentials.", 404);
    }

    const isPasswordValid = await user.verifyCredentials(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials.", 401);
    }

    return this.loginUser(user, res, options);
  }

  async loginUser(user, res, options = {}) {
    const { tokenIssuer, queuePublisher } = this.dependencies;

    if (user.isBlocked) {
      throw new AppError("Your account has been blocked. Contact support for help.", 403, {
        code: "ACCOUNT_BLOCKED",
      });
    }

    const accessToken = tokenIssuer(user, res);
    let refreshToken = null;
    try {
      refreshToken = await createRefreshToken({
        userId: user._id,
        deviceId: options?.deviceId || null,
        userAgent: options?.userAgent || "",
        ipAddress: options?.ipAddress || "",
        res,
      });
    } catch (error) {
      logger.error("Failed to create refresh token during login:", error);
    }

    try {
      queuePublisher({ event: "user_logged_in", email: user.email, name: user.fullName });
    } catch {
      // Queue failures should not block auth flow.
    }

    return {
      ...sanitizeUserData(user),
      token: accessToken,
      accessToken,
      refreshToken,
    };
  }

  async logout({ token, refreshToken, res }) {
    const { tokenBlacklistService } = this.dependencies;

    // Revoke refresh token and clear refresh cookie
    try {
      await revokeRefreshToken({ rawRefreshToken: refreshToken, res });
    } catch (error) {
      logger.warn("Failed to revoke refresh token on logout:", { message: error.message });
    }

    // Best-effort — drops the user from the admin "live users" count
    // immediately on an explicit logout, instead of waiting out the full
    // 5-minute window. Decoded before blacklisting since it's still a
    // valid token at this point; failures here must never block logout.
    if (token) {
      try {
        const jwtSecret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
        const decoded = jwt.verify(token, jwtSecret);
        if (decoded?.id) {
          await User.updateOne({ _id: decoded.id }, { $set: { lastActiveAt: null } });
          await invalidateUserProfileCache(decoded.id);
        }
      } catch (error) {
        logger.warn("Failed to clear lastActiveAt on logout (non-fatal):", { message: error.message });
      }

      await tokenBlacklistService(res, token);
    }

    // Must match the attributes issueAccessToken() used to set this cookie
    // (utils/jwt.js) exactly — a mismatched `secure`/`sameSite` can make the
    // browser silently refuse to overwrite/clear it, leaving the old
    // (still-valid, non-blacklisted-until-above) cookie in place.
    const isProduction = (process.env.NODE_ENV || "development") === "production";
    res.cookie("syncspace_token", "", {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
      maxAge: 0,
    });
  }

  async onboarding({ currentUserId, payload }) {
    const { userRepository, streamUpdater } = this.dependencies;

    const {
      fullName,
      bio,
      mobileNumber,
      preferredLanguage,
      primaryRole,
      activeRole,
      userRoles,
      roleProfiles,
      city,
      preferredLocalities,
      propertyTypePreferences,
      budgetMin,
      budgetMax,
      listingIntent,
      homeBase,
      travelStyle,
      travelInterests,
      favoriteDestinations,
      nativeLanguage,
      learningLanguage,
      location,
      profilePic,
    } = payload;

    const normalizedUserRoles = Array.isArray(userRoles)
      ? userRoles.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const normalizedPropertyTypes = Array.isArray(propertyTypePreferences)
      ? propertyTypePreferences.map((item) => String(item || "").trim()).filter(Boolean)
      : Array.isArray(travelInterests)
        ? travelInterests.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
    const normalizedPreferredLocalities = Array.isArray(preferredLocalities)
      ? preferredLocalities.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const normalizedLegacyDestinations = Array.isArray(favoriteDestinations)
      ? favoriteDestinations.map((item) => String(item || "").trim()).filter(Boolean)
      : [];

    const resolvedPrimaryRole = String(primaryRole || activeRole || travelStyle || learningLanguage || "").trim();
    const resolvedActiveRole = String(activeRole || resolvedPrimaryRole || "").trim();
    const resolvedRoleList = normalizedUserRoles.length > 0
      ? normalizedUserRoles
      : resolvedPrimaryRole
        ? [resolvedPrimaryRole]
        : [];
    const resolvedCity = String(city || homeBase || location || "").trim();
    const fallbackPropertyType = String(nativeLanguage || "").trim();
    const resolvedPropertyTypes = normalizedPropertyTypes.length > 0
      ? normalizedPropertyTypes
      : fallbackPropertyType
        ? [fallbackPropertyType]
        : [];
    const resolvedBudgetMin = Number.isFinite(Number(budgetMin)) ? Math.max(0, Number(budgetMin)) : 0;
    const resolvedBudgetMax = Number.isFinite(Number(budgetMax)) ? Math.max(0, Number(budgetMax)) : 0;
    const resolvedListingIntent = String(listingIntent || "").trim();

    if (!fullName || !resolvedCity || !resolvedPrimaryRole) {
      throw new AppError("All fields are required.", 400, {
        missingFields: [
          !fullName && "fullName",
          !resolvedCity && "city",
          !resolvedPrimaryRole && "primaryRole",
        ].filter(Boolean),
      });
    }

    const resolvedBio = String(bio || "").trim() || `${String(fullName).trim()} is active on NearMySpace as ${resolvedPrimaryRole.toLowerCase()} in ${resolvedCity}.`;
    const normalizedRoleProfiles = roleProfiles && typeof roleProfiles === "object" && !Array.isArray(roleProfiles)
      ? roleProfiles
      : {};

    const updatePayload = {
      fullName: String(fullName).trim(),
      bio: resolvedBio,
      profilePic: String(profilePic || "").trim(),
      mobileNumber: String(mobileNumber || "").trim(),
      preferredLanguage: String(preferredLanguage || "").trim(),
      primaryRole: resolvedPrimaryRole,
      activeRole: resolvedActiveRole,
      userRoles: resolvedRoleList,
      city: resolvedCity,
      location: resolvedCity,
      preferredLocalities: normalizedPreferredLocalities,
      propertyTypePreferences: resolvedPropertyTypes,
      budgetMin: resolvedBudgetMin,
      budgetMax: resolvedBudgetMax,
      listingIntent: resolvedListingIntent,
      roleProfiles: normalizedRoleProfiles,
      // Legacy fields retained temporarily so existing clients continue to work.
      homeBase: resolvedCity,
      travelStyle: resolvedPrimaryRole,
      travelInterests: resolvedPropertyTypes,
      favoriteDestinations: normalizedLegacyDestinations,
      isOnboarded: true,
    };

    if (typeof nativeLanguage === "string") {
      updatePayload.nativeLanguage = String(nativeLanguage || "").trim();
    }
    if (typeof learningLanguage === "string") {
      updatePayload.learningLanguage = String(learningLanguage || "").trim();
    }

    const updatedUser = await userRepository.updateById(currentUserId, updatePayload);
    if (!updatedUser) {
      throw new AppError("User not found.", 404);
    }

    try {
      await streamUpdater({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
    } catch {
      // Stream sync failures should not block onboarding.
    }

    return sanitizeUserData(updatedUser);
  }
}
