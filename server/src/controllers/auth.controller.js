import { validationResult } from "express-validator";
import User from "../models/User.model.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import { logger } from "../utils/logger.js";
import generateAccessToken from "../services/generateToken.service.js";
import { addTokenBlacklist } from "../services/tokenBlacklist.service.js";
import { UpdateStreamUser } from "../services/stream.service.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";
import { sendEmail } from "../services/Email.service.js";
import { publishToQueue } from "../config/queue.config.js";

// **Signup**
export async function signup(req, res) {
  // Log the incoming request
  logger.info(`Received signup request: ${req.body.email}`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(
      "Validation errors during signup: ",
      JSON.stringify(errors.array())
    );
    return sendErrorResponse(res, 400, "Validation failed", errors.array());
  }

  const { fullName, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      logger.warn(`Signup failed- Email already exist:  ${email}`);
      return sendErrorResponse(
        res,
        400,
        "Email already exists. Please use a different email."
      );
    }

    const newUser = await User({
      fullName,
      email,
      password,
      profilePic: "",
    });

    if (newUser) {
      generateAccessToken(newUser, res);
      const savedUser = await newUser.save();

      // **Create the user in stream also
      try {
        await UpdateStreamUser({
          id: newUser._id.toString(),
          name: newUser.fullName,
          image: newUser.profilePic || "",
        });
        logger.info(`Stream user updated successfully: ${newUser.fullName}`);
      } catch (error) {
        logger.error("Error updating Stream user:", error);
      } 

      // Log successful signup
      logger.info(`User created successfully: ${newUser.email}`);

      const sanitizedUser = sanitizeUserData(newUser);
      sendSuccessResponse(res, 201, "User created successfully", sanitizedUser);

      // **Publish login event to message queue for welcome email
      try {
        publishToQueue({
          event: "user_logged_in",
          email: email,
          name: fullName,
        });
      } catch (error) {
        logger.error("Error sending welcome email:", error);
      }
    } else {
      return sendErrorResponse(
        res,
        500,
        "Failed to create user. Please try again later."
      );
    }
  } catch (error) {
    logger.error("Error during signup:", error);
    return sendErrorResponse(
      res,
      500,
      "Internal server error. Please try again later."
    );
  }
}

// **Login**
export async function login(req, res) {
  // Log the incoming request
  logger.info(`Received login request: ${req.body.email}`);

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.warn(
      "Validation errors during login: ",
      JSON.stringify(errors.array())
    );
    return sendErrorResponse(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }, "+password +email");

    if (!user) {
      logger.warn(`Login failed - User not found: ${email}`);
      return sendErrorResponse(res, 404, "Invalid credentials.");
    }

    const isPasswordValid = await user.verifyCredentials(password);

    if (!isPasswordValid) {
      logger.warn(`Login failed - Invalid password for user: ${email}`);
      return sendErrorResponse(res, 401, "Invalid credentials.");
    }

    // **Generate access token
    generateAccessToken(user, res);

    const sanitizedUser = sanitizeUserData(user);
    logger.info(`User logged in successfully: ${user.email}`);

    // **Publish login event to message queue for welcome email
    publishToQueue({
      event: "user_logged_in",
      email: user.email,
      name: user.fullName,
    });

    sendSuccessResponse(res, 200, "Login successful", sanitizedUser);
  } catch (error) {
    logger.error("Error during login:", error);
    return sendErrorResponse(res, 500, "Internal server error.");
  }
}

// **Logout**
export async function logout(req, res) {
  // **Log the incoming request
  logger.info(`Received logout request for user`);

  try {
    // **Invalidate the token by not sending a new one
    const token =
      req.cookies.syncspace_token || req.headers.authorization?.split(" ")[1];

    await addTokenBlacklist(res, token);

    // **Clear authentication cookies
    const cookieOptions = {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV !== "development",
      maxAge: 0, // Set maxAge to 0 to delete the cookie immediately
    };

    res.cookie("syncspace_token", "", cookieOptions);

    logger.info(`User logged out successfully`);
    return sendSuccessResponse(res, 200, "Logout successful");
  } catch (error) {
    logger.error("Error during logout:", error);
    return sendErrorResponse(res, 500, "Internal server error.");
  }
}

// **Onboarding**
export async function onboarding(req, res) {
  try {
    const userId = req.user._id;
    logger.info(`Onboarding request for user ID: ${userId}`);

    const {
      fullName,
      bio,
      nativeLanguage,
      learningLanguage,
      location,
      profilePic,
    } = req.body;

    if (
      !fullName ||
      !bio ||
      !nativeLanguage ||
      !learningLanguage ||
      !location
    ) {
      logger.warn("Onboarding failed - Missing required fields");
      return sendErrorResponse(res, 400, "All fields are required.", {
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !nativeLanguage && "nativeLanguage",
          !learningLanguage && "learningLanguage",
          !location && "location",
        ].filter(Boolean),
      });
    }

    // **Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
      { new: true }
    );

    if (!updatedUser) {
      logger.warn(`Onboarding failed - User not found: ${userId}`);
      return sendErrorResponse(res, 404, "User not found.");
    }

    try {
      await UpdateStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
      logger.info(`Stream user updated successfully: ${updatedUser.fullName}`);
    } catch (error) {
      logger.error("Error updating Stream user:", error.message);
    }

    const santizedUser = sanitizeUserData(updatedUser);

    return sendSuccessResponse(res, 200, "Onboarding successful", {
      user: santizedUser,
    });
  } catch (error) {
    logger.error("Error during onboarding:", error);
    return sendErrorResponse(res, 500, "Internal server error.");
  }
}
