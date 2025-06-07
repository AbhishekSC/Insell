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

export async function login(req, res) {
  res.send("Login route");
}

export async function logout(req, res) {
  res.send("Logout route");
}
