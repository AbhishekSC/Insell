import "dotenv/config";
import mongoose from "mongoose";
import http from "http";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import app from "../src/app.js";
import User from "../src/models/User.model.js";
import RefreshToken from "../src/models/RefreshToken.model.js";
import { connectToRedis, closeRedisConnection } from "../src/config/redisClient.config.js";

let server;
let baseUrl;
let testUser;
const testPassword = "Password123!";

beforeAll(async () => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (mongoose.connection.readyState === 0 && uri) {
    await mongoose.connect(uri);
  }
  await connectToRedis();

  await new Promise((resolve) => {
    server = http.createServer(app).listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  const timestamp = Date.now();
  testUser = await User.create({
    fullName: "Dual Token Test User",
    email: `dual-token-${timestamp}@test.com`,
    password: testPassword,
    isVerified: true,
  });
});

afterAll(async () => {
  if (testUser?._id) {
    await User.deleteOne({ _id: testUser._id });
    await RefreshToken.deleteMany({ user: testUser._id });
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await closeRedisConnection();
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Dual-Token Authentication & Rotation", () => {
  let initialAccessToken;
  let initialRefreshToken;

  it("login issues both accessToken and refreshToken", async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser.email,
        password: testPassword,
        deviceId: "test-device-uuid-123",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.token).toBe(json.data.accessToken); // Backwards compatibility check

    initialAccessToken = json.data.accessToken;
    initialRefreshToken = json.data.refreshToken;
  });

  it("POST /api/auth/refresh rotates tokens successfully", async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: initialRefreshToken,
        deviceId: "test-device-uuid-123",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("success");
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.refreshToken).not.toBe(initialRefreshToken); // Token must be rotated

    // Verify the new access token works against an authenticated endpoint
    const verifyRes = await fetch(`${baseUrl}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${json.data.accessToken}`,
      },
    });
    expect(verifyRes.status).toBe(200);
  });

  it("replaying an old (already rotated) refresh token triggers replay protection", async () => {
    const res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: initialRefreshToken, // Replaying the old rotated token
      }),
    });

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.status).toBe("error");
  });

  it("logout revokes the refresh token", async () => {
    // 1. Fresh login
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUser.email,
        password: testPassword,
      }),
    });
    const loginJson = await loginRes.json();
    const { accessToken, refreshToken } = loginJson.data;

    // 2. Logout with refresh token
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    expect(logoutRes.status).toBe(200);

    // 3. Trying to refresh with the logged-out refresh token should fail with 401
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    expect(refreshRes.status).toBe(401);
  });

  it("POST /api/auth/logout-all revokes all sessions across all devices", async () => {
    // 1. Session on Device 1 (e.g. Phone)
    const phoneRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: testPassword, deviceId: "phone-1" }),
    });
    const phoneJson = await phoneRes.json();
    const phoneRefreshToken = phoneJson.data.refreshToken;

    // 2. Session on Device 2 (e.g. Laptop)
    const laptopRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testUser.email, password: testPassword, deviceId: "laptop-2" }),
    });
    const laptopJson = await laptopRes.json();
    const laptopAccessToken = laptopJson.data.accessToken;
    const laptopRefreshToken = laptopJson.data.refreshToken;

    // 3. Click "Log out of all devices" from Laptop
    const logoutAllRes = await fetch(`${baseUrl}/api/auth/logout-all`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${laptopAccessToken}`,
      },
    });
    expect(logoutAllRes.status).toBe(200);

    // 4. Stolen Phone's refresh token must now be rejected
    const phoneRefreshAttempt = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: phoneRefreshToken }),
    });
    expect(phoneRefreshAttempt.status).toBe(401);

    // 5. Laptop's own refresh token must also be rejected
    const laptopRefreshAttempt = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: laptopRefreshToken }),
    });
    expect(laptopRefreshAttempt.status).toBe(401);
  });
});
