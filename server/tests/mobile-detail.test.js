import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, afterEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import MobileDetail from "../src/models/MobileDetail.model.js";
import {
  syncMobileDetail,
  getUserDevices,
  deactivateDevice,
  registerFcmToken,
  unregisterFcmToken,
} from "../src/services/UserServiceHandlers.js";

const mkUser = (suffix) =>
  User.create({
    fullName: `Mobile Test ${suffix}`,
    email: `mobile-test-${suffix}-${Date.now()}@t.test`,
    password: "TestPass1!",
    isVerified: true,
  });

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
const createdDeviceIds = [];

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
});

afterAll(async () => {
  if (createdDeviceIds.length > 0) {
    await MobileDetail.deleteMany({ deviceId: { $in: createdDeviceIds } });
  }
  await mongoose.disconnect();
});

afterEach(async () => {
  if (user) {
    await MobileDetail.deleteMany({ user: user._id });
    await User.deleteOne({ _id: user._id });
  }
  user = undefined;
});

describe("MobileDetail model & device tracking handlers", () => {
  it("syncs mobile device details and creates a MobileDetail record", async () => {
    user = await mkUser("sync1");
    const testDeviceId = `dev-test-${Date.now()}`;
    createdDeviceIds.push(testDeviceId);

    const req = {
      user: { _id: user._id },
      headers: { "x-forwarded-for": "103.21.244.2" },
      body: {
        deviceId: testDeviceId,
        brand: "Apple",
        manufacturer: "Apple",
        modelName: "iPhone 15 Pro",
        deviceType: "PHONE",
        isPhysicalDevice: true,
        totalMemoryMB: 7800,
        platform: "ios",
        osName: "iOS",
        osVersion: "17.4.1",
        appVersion: "1.0.4",
        buildNumber: "42",
        bundleId: "com.insell.app",
        pushToken: "apns-token-xyz-123",
        pushTokenType: "fcm",
        pushPermissionStatus: "granted",
        locale: "en-IN",
        timezone: "Asia/Kolkata",
      },
    };
    const res = mkRes();

    await syncMobileDetail(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("success");

    // Verify MobileDetail in DB
    const device = await MobileDetail.findOne({ user: user._id, deviceId: testDeviceId }).lean();
    expect(device).toBeDefined();
    expect(device.brand).toBe("Apple");
    expect(device.modelName).toBe("iPhone 15 Pro");
    expect(device.platform).toBe("ios");
    expect(device.osVersion).toBe("17.4.1");
    expect(device.appVersion).toBe("1.0.4");
    expect(device.pushToken).toBe("apns-token-xyz-123");
    expect(device.pushPermissionStatus).toBe("granted");
    expect(device.ipAddress).toBe("103.21.244.2");
    expect(device.isActive).toBe(true);

    // Verify User.fcmTokens was also synced for push compatibility
    const freshUser = await User.findById(user._id).select("fcmTokens").lean();
    expect(freshUser.fcmTokens).toEqual([
      expect.objectContaining({ token: "apns-token-xyz-123", platform: "ios" }),
    ]);
  });

  it("retrieves active user devices via getUserDevices", async () => {
    user = await mkUser("list");
    const dev1 = `dev-phone-${Date.now()}`;
    const dev2 = `dev-tablet-${Date.now()}`;
    createdDeviceIds.push(dev1, dev2);

    await MobileDetail.create([
      {
        user: user._id,
        deviceId: dev1,
        platform: "android",
        modelName: "Samsung Galaxy S23",
        isActive: true,
        lastActiveAt: new Date(),
      },
      {
        user: user._id,
        deviceId: dev2,
        platform: "ios",
        modelName: "iPad Air",
        deviceType: "TABLET",
        isActive: false, // inactive device
        lastActiveAt: new Date(Date.now() - 100000),
      },
    ]);

    const res = mkRes();
    await getUserDevices({ user: { _id: user._id } }, res);

    expect(res.statusCode).toBe(200);
    // Should only return active device
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].modelName).toBe("Samsung Galaxy S23");
  });

  it("deactivates a device and clears its pushToken", async () => {
    user = await mkUser("deactivate");
    const testDeviceId = `dev-deact-${Date.now()}`;
    createdDeviceIds.push(testDeviceId);

    await MobileDetail.create({
      user: user._id,
      deviceId: testDeviceId,
      platform: "android",
      modelName: "Pixel 8",
      pushToken: "tok-to-clear",
      isActive: true,
    });
    await User.updateOne(
      { _id: user._id },
      { $push: { fcmTokens: { token: "tok-to-clear", platform: "android", updatedAt: new Date() } } }
    );

    const res = mkRes();
    await deactivateDevice({ user: { _id: user._id }, params: { deviceId: testDeviceId } }, res);

    expect(res.statusCode).toBe(200);

    const freshDevice = await MobileDetail.findOne({ user: user._id, deviceId: testDeviceId }).lean();
    expect(freshDevice.isActive).toBe(false);
    expect(freshDevice.pushToken).toBeNull();

    const freshUser = await User.findById(user._id).select("fcmTokens").lean();
    expect(freshUser.fcmTokens).toEqual([]);
  });

  it("registerFcmToken with deviceId syncs with MobileDetail", async () => {
    user = await mkUser("fcm-sync");
    const testDeviceId = `dev-fcm-sync-${Date.now()}`;
    createdDeviceIds.push(testDeviceId);

    const res = mkRes();
    await registerFcmToken(
      {
        user: { _id: user._id },
        body: { token: "token-fcm-123", platform: "android", deviceId: testDeviceId },
      },
      res
    );

    expect(res.statusCode).toBe(200);

    const device = await MobileDetail.findOne({ user: user._id, deviceId: testDeviceId }).lean();
    expect(device).toBeDefined();
    expect(device.pushToken).toBe("token-fcm-123");
    expect(device.platform).toBe("android");
    expect(device.isActive).toBe(true);
  });
});
