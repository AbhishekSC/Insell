import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import app from "../src/app.js";
import User from "../src/models/User.model.js";
import * as emailClient from "../src/utils/emailClient.js";
import { connectToRedis, closeRedisConnection } from "../src/config/redisClient.config.js";

let server;
let baseUrl;
let testUser;
let blockedUser;

beforeAll(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState === 0 && uri) {
    await mongoose.connect(uri);
  }
  await connectToRedis();

  // Spy on email sender so real emails are never dispatched
  vi.spyOn(emailClient, "sendLoginOTPEmail").mockResolvedValue({ success: true, id: "mock_otp_mail_123" });

  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const timestamp = Date.now();
  testUser = await User.create({
    fullName: "OTP Login User",
    email: `otp-login-${timestamp}@test.com`,
    password: "Password123!",
    isVerified: true,
  });

  blockedUser = await User.create({
    fullName: "Blocked OTP User",
    email: `blocked-otp-${timestamp}@test.com`,
    password: "Password123!",
    isVerified: true,
    isBlocked: true,
  });
});

afterAll(async () => {
  if (testUser) await User.deleteOne({ _id: testUser._id });
  if (blockedUser) await User.deleteOne({ _id: blockedUser._id });
  if (server) await new Promise((r) => server.close(r));
  await closeRedisConnection();
  vi.restoreAllMocks();
});

describe("Passwordless OTP Login Feature", () => {
  it("rejects requestLoginOTP if email is missing (400 or 401 from rate limiter)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    expect([400, 401]).toContain(res.status);
    expect(data.message).toMatch(/Email is required/i);
  });

  it("strictly enforces signup first: returns 404 if email does not exist on platform", async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `nonexistent-${Date.now()}@test.com` }),
    });
    const data = await res.json();
    expect(res.status).toBe(404);
    expect(data.status).toBe("error");
    expect(data.message).toMatch(/No account found with this email\. Please sign up first\./i);
  });

  it("blocks OTP request for blocked accounts (403)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: blockedUser.email }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.status).toBe("error");
  });

  it("successfully generates 6-digit OTP and sends email for registered user (200)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp-login/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("success");
    expect(emailClient.sendLoginOTPEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: testUser.email,
        otp: expect.stringMatching(/^\d{6}$/),
      })
    );

    // Verify OTP was stored on user in database
    const freshUser = await User.findById(testUser._id).select("+loginOTP +loginOTPExpires +loginOTPAttempts");
    expect(freshUser.loginOTP).toBeDefined();
    expect(freshUser.loginOTP.length).toBe(6);
    expect(freshUser.loginOTPExpires).toBeDefined();
    expect(new Date(freshUser.loginOTPExpires).getTime()).toBeGreaterThan(Date.now());
  });

  it("fails verifyLoginOTP with wrong OTP (400)", async () => {
    const res = await fetch(`${baseUrl}/api/auth/otp-login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, otp: "999999" }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.status).toBe("error");
    expect(data.message).toMatch(/Invalid or expired login code/i);

    const freshUser = await User.findById(testUser._id).select("+loginOTPAttempts");
    expect(freshUser.loginOTPAttempts).toBe(1);
  });

  it("successfully verifies correct OTP, logs in user, issues token, and clears OTP (200)", async () => {
    // Fetch the generated OTP from DB
    const freshUser = await User.findById(testUser._id).select("+loginOTP");
    const validOtp = freshUser.loginOTP;

    const res = await fetch(`${baseUrl}/api/auth/otp-login/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, otp: validOtp }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe("success");
    expect(data.data.token).toBeDefined();
    expect(data.data.email).toBe(testUser.email);
    expect(data.data.fullName).toBe(testUser.fullName);

    // Ensure OTP is cleared from database
    const clearedUser = await User.findById(testUser._id).select("+loginOTP +loginOTPExpires");
    expect(clearedUser.loginOTP).toBeUndefined();
    expect(clearedUser.loginOTPExpires).toBeUndefined();
  });
});
