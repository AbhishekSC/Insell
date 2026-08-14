import BaseService from "./BaseService.js";
import AppError from "../exceptions/AppError.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";

export default class AuthService extends BaseService {
  constructor({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService }) {
    super({ userRepository, tokenIssuer, streamUpdater, queuePublisher, tokenBlacklistService });
  }

  async signup({ fullName, email, password, res }) {
    const { userRepository, tokenIssuer, streamUpdater, queuePublisher } = this.dependencies;

    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError("Email already exists. Please use a different email.", 400);
    }

    const newUser = await userRepository.create({
      fullName,
      email,
      password,
      profilePic: "",
    });

    tokenIssuer(newUser, res);

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
      queuePublisher({ event: "user_logged_in", email, name: fullName });
    } catch {
      // Queue failures should not block auth flow.
    }

    return sanitizeUserData(newUser);
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
      throw new AppError("Your account has been blocked. Contact support for help.", 403);
    }

    tokenIssuer(user, res);

    try {
      queuePublisher({ event: "user_logged_in", email: user.email, name: user.fullName });
    } catch {
      // Queue failures should not block auth flow.
    }

    return sanitizeUserData(user);
  }

  async logout({ token, res }) {
    const { tokenBlacklistService } = this.dependencies;

    await tokenBlacklistService(res, token);

    res.cookie("syncspace_token", "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
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
