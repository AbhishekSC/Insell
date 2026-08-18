import bcrypt from "bcryptjs";
import BaseService from "./BaseService.js";
import AppError from "../exceptions/AppError.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import { SCHEMA_CONSTANTS } from "../utils/constants.js";
import PendingSignup from "../models/PendingSignup.model.js";
import { generateVerificationCode, VERIFICATION_CODE_EXPIRY_MINUTES } from "./VerificationService.js";
import { sendVerificationEmail, sendWelcomeEmail } from "./EmailService.js";
import { logger } from "../utils/logger.js";

const { BCRYPT_SALT_ROUNDS } = SCHEMA_CONSTANTS;

export default class AuthService extends BaseService {
  constructor({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService }) {
    super({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService });
  }

  // Signup no longer creates a User row — it stages the attempt in
  // PendingSignup and emails an OTP. The real account is only created once
  // that code is verified (see verifySignup below), so an abandoned signup
  // never leaves a permanently-unverified, unusable User behind — it just
  // expires via PendingSignup's TTL index instead.
  async signup({ fullName, email, password }) {
    const { userRepository } = this.dependencies;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError("Email already exists. Please use a different email.", 400);
    }

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(BCRYPT_SALT_ROUNDS));
    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    // Re-attempting a signup with the same (still-unverified) email just
    // refreshes the pending record and issues a new code, rather than
    // erroring — this is also how a stuck/expired signup gets resumed.
    const pendingSignup = await PendingSignup.findOneAndUpdate(
      { email },
      { fullName, email, password: hashedPassword, verificationCode, verificationCodeExpires },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    try {
      await sendVerificationEmail(pendingSignup.email, verificationCode, pendingSignup.fullName);
    } catch (error) {
      logger.error("Failed to send signup verification email:", error);
      logger.info(`Verification code for ${email}: ${verificationCode}`);
    }

    return { email: pendingSignup.email, expiresAt: verificationCodeExpires };
  }

  // Promotes a verified PendingSignup into a real User — this is the only
  // point at which a signup actually creates a DB row and a login session.
  async verifySignup({ email, code, res }) {
    const { userRepository, tokenIssuer, streamUpdater, queuePublisher } = this.dependencies;

    const pendingSignup = await PendingSignup.findOne({ email });
    if (!pendingSignup) {
      throw new AppError("No pending signup found for this email. Please sign up again.", 404);
    }

    if (pendingSignup.verificationCodeExpires < new Date()) {
      throw new AppError("Verification code has expired. Please request a new one.", 400);
    }

    if (pendingSignup.verificationCode !== code) {
      throw new AppError("Invalid verification code", 400);
    }

    const existingUser = await userRepository.findByEmail(email);
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

    const accessToken = tokenIssuer(newUser, res);

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

    // Cookie auth is unreliable cross-site (Safari blocks third-party
    // cookies by default) — also hand the token back in the body so the
    // client can send it as an Authorization header instead.
    return { ...sanitizeUserData(newUser), token: accessToken };
  }

  // Resends a fresh OTP for a still-pending (not yet verified) signup.
  async resendSignupCode({ email }) {
    const pendingSignup = await PendingSignup.findOne({ email });
    if (!pendingSignup) {
      throw new AppError("No pending signup found for this email. Please sign up again.", 404);
    }

    const verificationCode = generateVerificationCode();
    const verificationCodeExpires = new Date(Date.now() + VERIFICATION_CODE_EXPIRY_MINUTES * 60 * 1000);

    pendingSignup.verificationCode = verificationCode;
    pendingSignup.verificationCodeExpires = verificationCodeExpires;
    await pendingSignup.save();

    try {
      await sendVerificationEmail(pendingSignup.email, verificationCode, pendingSignup.fullName);
    } catch (error) {
      logger.error("Failed to send signup verification email:", error);
      logger.info(`Verification code for ${email}: ${verificationCode}`);
    }

    return { email: pendingSignup.email, expiresAt: verificationCodeExpires };
  }

  async login({ email, password, res }) {
    const { userRepository, tokenIssuer, queuePublisher } = this.dependencies;

    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      throw new AppError("Invalid credentials.", 404);
    }

    const isPasswordValid = await user.verifyCredentials(password);
    if (!isPasswordValid) {
      throw new AppError("Invalid credentials.", 401);
    }

    if (user.isBlocked) {
      throw new AppError("Your account has been blocked. Contact support for help.", 403, {
        code: "ACCOUNT_BLOCKED",
      });
    }

    const accessToken = tokenIssuer(user, res);

    try {
      queuePublisher({ event: "user_logged_in", email: user.email, name: user.fullName });
    } catch {
      // Queue failures should not block auth flow.
    }

    return { ...sanitizeUserData(user), token: accessToken };
  }

  async logout({ token, res }) {
    const { tokenBlacklistService } = this.dependencies;

    await tokenBlacklistService(res, token);

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

    const resolvedBio = String(bio || "").trim() || `${String(fullName).trim()} is active on Insell as ${resolvedPrimaryRole.toLowerCase()} in ${resolvedCity}.`;
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
