import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import { registerFcmToken, unregisterFcmToken } from "../src/services/UserServiceHandlers.js";

const mk = (suffix) =>
  User.create({
    fullName: `FCM Reg ${suffix}`,
    email: `fcm-reg-${suffix}-${Date.now()}@t.test`,
    password: "TestPass1!",
    isVerified: true,
  });

// Minimal req/res doubles — these handlers are plain Express-style
// functions, no supertest/HTTP layer needed to exercise them.
function mkRes() {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
}

let user;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
});

afterAll(async () => {
  await mongoose.disconnect();
});

afterEach(async () => {
  if (user) await User.deleteOne({ _id: user._id });
  user = undefined;
});

describe("registerFcmToken / unregisterFcmToken — platform tagging", () => {
  it("defaults platform to web when the caller doesn't send one (existing web client behavior)", async () => {
    user = await mk("default");
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-1" } }, mkRes());

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    expect(fresh.fcmTokens).toEqual([expect.objectContaining({ token: "tok-1", platform: "web" })]);
  });

  it("stores the platform the mobile app sends", async () => {
    user = await mk("ios");
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-ios", platform: "ios" } }, mkRes());

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    expect(fresh.fcmTokens).toEqual([expect.objectContaining({ token: "tok-ios", platform: "ios" })]);
  });

  it("rejects an unrecognized platform value by falling back to web, rather than storing garbage", async () => {
    user = await mk("bad-platform");
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-x", platform: "toaster" } }, mkRes());

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    expect(fresh.fcmTokens[0].platform).toBe("web");
  });

  it("re-registering the same token replaces the old entry instead of duplicating it", async () => {
    user = await mk("dedupe");
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-dup", platform: "android" } }, mkRes());
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-dup", platform: "android" } }, mkRes());

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    expect(fresh.fcmTokens).toHaveLength(1);
  });

  it("unregisters by token regardless of platform", async () => {
    user = await mk("unregister");
    await registerFcmToken({ user: { _id: user._id }, body: { token: "tok-gone", platform: "ios" } }, mkRes());
    await unregisterFcmToken({ user: { _id: user._id }, body: { token: "tok-gone" } }, mkRes());

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    expect(fresh.fcmTokens).toHaveLength(0);
  });

  it("requires a non-empty token for both endpoints", async () => {
    user = await mk("missing-token");
    const res1 = mkRes();
    await registerFcmToken({ user: { _id: user._id }, body: {} }, res1);
    expect(res1.statusCode).toBe(400);

    const res2 = mkRes();
    await unregisterFcmToken({ user: { _id: user._id }, body: {} }, res2);
    expect(res2.statusCode).toBe(400);
  });
});
