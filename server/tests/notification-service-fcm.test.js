import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import User from "../src/models/User.model.js";

// Isolate NotificationService from the real FCM/Stream/email integrations —
// these tests are about *how tokens get grouped and what payload each group
// gets*, not about Firebase itself.
vi.mock("../src/services/firebase.service.js", () => ({
  sendPushNotification: vi.fn(async () => ({ sent: 1, staleTokens: [] })),
}));
vi.mock("../src/services/stream.service.js", () => ({
  pushRealtimeNotification: vi.fn(async () => {}),
}));
vi.mock("../src/utils/emailClient.js", () => ({
  sendGenericEmail: vi.fn(async () => {}),
}));

const { sendPushNotification } = await import("../src/services/firebase.service.js");
const { send, NotificationChannel } = await import("../src/services/NotificationService.js");

const mk = (suffix, fcmTokens) =>
  User.create({
    fullName: `FCM Test ${suffix}`,
    email: `fcm-test-${suffix}-${Date.now()}@t.test`,
    password: "TestPass1!",
    isVerified: true,
    fcmTokens,
  });

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

beforeEach(() => {
  sendPushNotification.mockClear();
  sendPushNotification.mockResolvedValue({ sent: 1, staleTokens: [] });
});

describe("NotificationService.send — FIREBASE channel platform split", () => {
  it("sends web tokens a payload with a derived `url`, and mobile tokens the same type/ids with no url", async () => {
    user = await mk("split", [
      { token: "web-token-1", platform: "web" },
      { token: "ios-token-1", platform: "ios" },
      { token: "android-token-1", platform: "android" },
    ]);

    await send({
      recipientId: String(user._id),
      type: "property_like",
      message: "Someone liked your property",
      data: { propertyPost: "post123" },
      channels: [NotificationChannel.FIREBASE],
    });

    expect(sendPushNotification).toHaveBeenCalledTimes(2);

    const webCall = sendPushNotification.mock.calls.find(([tokens]) => tokens.includes("web-token-1"));
    expect(webCall[0]).toEqual(["web-token-1"]);
    expect(webCall[1].data).toEqual({ type: "property_like", propertyPost: "post123", url: "/property/post123" });

    const mobileCall = sendPushNotification.mock.calls.find(([tokens]) => tokens.includes("ios-token-1"));
    expect(mobileCall[0].sort()).toEqual(["android-token-1", "ios-token-1"]);
    expect(mobileCall[1].data).toEqual({ type: "property_like", propertyPost: "post123" });
    expect(mobileCall[1].data.url).toBeUndefined();
  });

  it("treats a legacy plain-string fcmTokens entry as a web token", async () => {
    // A genuinely legacy record predates the { token, platform } shape and
    // has a raw string sitting in fcmTokens — only reachable through the
    // driver directly, since the Mongoose model now requires the new shape
    // on write (this is exactly what makes it "legacy": nothing can write
    // this shape anymore, but old rows may still have it).
    user = await mk("legacy", []);
    await mongoose.connection
      .collection("users")
      .updateOne({ _id: user._id }, { $set: { fcmTokens: ["legacy-plain-token"] } });

    await send({
      recipientId: String(user._id),
      type: "circle_invite",
      message: "You were invited",
      data: { circle: "circle123" },
      channels: [NotificationChannel.FIREBASE],
    });

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    const [tokens, options] = sendPushNotification.mock.calls[0];
    expect(tokens).toEqual(["legacy-plain-token"]);
    expect(options.data.url).toBe("/marketplace?section=communities");
  });

  it("only sends to the platforms actually present", async () => {
    user = await mk("ios-only", [{ token: "ios-only-token", platform: "ios" }]);

    await send({
      recipientId: String(user._id),
      type: "review_received",
      message: "You got a review",
      channels: [NotificationChannel.FIREBASE],
    });

    expect(sendPushNotification).toHaveBeenCalledTimes(1);
    const [tokens, options] = sendPushNotification.mock.calls[0];
    expect(tokens).toEqual(["ios-only-token"]);
    expect(options.data).toEqual({ type: "review_received" });
  });

  it("removes only the reported stale token, from the { token, platform } shape", async () => {
    user = await mk("stale", [
      { token: "stale-token", platform: "web" },
      { token: "keep-token", platform: "web" },
    ]);
    sendPushNotification.mockResolvedValueOnce({ sent: 1, staleTokens: ["stale-token"] });

    await send({
      recipientId: String(user._id),
      type: "property_like",
      message: "Someone liked your property",
      data: { propertyPost: "post123" },
      channels: [NotificationChannel.FIREBASE],
    });

    const fresh = await User.findById(user._id).select("fcmTokens").lean();
    const tokens = fresh.fcmTokens.map((t) => (typeof t === "string" ? t : t.token));
    expect(tokens).toEqual(["keep-token"]);
  });

  it("no-ops without throwing when the recipient has no fcmTokens", async () => {
    user = await mk("none", []);
    await expect(
      send({
        recipientId: String(user._id),
        type: "property_like",
        message: "Someone liked your property",
        data: { propertyPost: "post123" },
        channels: [NotificationChannel.FIREBASE],
      })
    ).resolves.toBeDefined();
    expect(sendPushNotification).not.toHaveBeenCalled();
  });
});
