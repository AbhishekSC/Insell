import { validationResult } from "express-validator";
import User from "../models/User.model.js";
import { sanitizeUserData } from "../utils/sanitizeUser.js";
import { logger } from "../utils/logger.js";
import generateAccessToken from "../services/generateToken.service.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../utils/responseHandler.js";

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

    // TODO: Create the user in stream also

    const newUser = await User({
      fullName,
      email,
      password,
      profilePic: "",
    });

    if (newUser) {
      generateAccessToken(newUser, res);
      await newUser.save();

      // Log successful signup
      logger.info(`User created successfully: ${newUser.email}`);

      const sanitizedUser = sanitizeUserData(newUser);
      return sendSuccessResponse(
        res,
        201,
        "User created successfully",
        sanitizedUser
      );
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
    const user = await User.findOne({ email }).select("+password");

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

    return sendSuccessResponse(res, 200, "Login successful", sanitizedUser);
  } catch (error) {
    logger.error("Error during login:", error);
    return sendErrorResponse(res, 500, "Internal server error.");
  }
}

export async function logout(req, res) {
  // **Log the incoming request
  logger.info(`Received logout request for user`);

  try {
    // **Invalidate the token by not sending a new one
    res.clearCookie("syncspace_token");

    logger.info(`User logged out successfully`);
    return sendSuccessResponse(res, 200, "Logout successful");
  } catch (error) {
    logger.error("Error during logout:", error);
    return sendErrorResponse(res, 500, "Internal server error.");
  }
}
