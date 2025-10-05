import jwt from "jsonwebtoken";
import crypto from "crypto";
import "dotenv/config";
import { logger } from "../utils/logger.js";

// Security constants with failsafe defaults
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    console.warn(
      "WARNING: JWT_SECRET not defined in environment variables, using random secret"
    );
    return crypto.randomBytes(64).toString("hex"); // Using 64 bytes for better security
  });

/*
 * What it does:
 * When you set a cookie in a browser, the domain attribute specifies which domains the cookie
 * will be sent to. By default, cookies are sent only to the exact domain that set them.
 * Multi-subdomain applications: If you have an application that spans multiple subdomains,
 * such as:
 * app.example.com
 * api.example.com
 * dashboard.example.com
 * Setting COOKIE_DOMAIN='.example.com' would allow your authentication cookie to be shared
 * across all these subdomains. This enables single sign-on across your entire application ecosystem.
 */

const JWT_EXPIRY = process.env.JWT_EXPIRES_IN || "4h";
const NODE_ENV = process.env.NODE_ENV || "development";

async function generateAccessToken(user, res) {
  try {
    const payload = {
      id: user._id,
      fullName: user.fullName,
      profilePic: user.profilePic,
    };

    const options = {
      expiresIn: JWT_EXPIRY,
      algorithm: "HS256",
    };

    // Generate token
    const accessToken = jwt.sign(payload, JWT_SECRET, options);

    // Set secure cookie options
    const cookieOptions = {
      httpOnly: true, // Prevents client-side JavaScript from accessing the cookie/token (prevent XSS attack)
      sameSite: "None", // CSRF attacks cross-site request forgery attack
      // secure: NODE_ENV === "production" ? true : false, // Use secure cookies in production (http/https, for Production it is true)
      secure: false, // Use secure cookies in production (http/https, for Production it is true)
      maxAge: 1 * 24 * 60 * 60 * 1000, // 7 day
    };

    // Setting cookies
    res.cookie("syncspace_token", accessToken, cookieOptions);
    return accessToken;
  } catch (error) {
    logger.error("Error generating access token", {
      error: error.message,
      stack: error.stack,
    });
    throw new Error("Authentication failed: Unable to generate token");
  }
}

// For backward compatibility
export default generateAccessToken;
