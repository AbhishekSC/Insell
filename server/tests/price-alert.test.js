import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import PriceAlert from "../src/models/PriceAlert.model.js";
import Notification from "../src/models/Notification.model.js";
import {
  setAlert,
  getMyAlert,
  removeAlert,
  listMyAlerts,
  notifyTriggeredAlerts,
} from "../src/modules/price-alert/priceAlert.app.service.js";
import { notifyPriceChange } from "../src/controllers/propertyPost.controller.js";

const mk = (s) =>
  User.create({ fullName: `PA ${s}`, email: `pa-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let owner, buyerA, buyerB, post;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await mk("owner");
  buyerA = await mk("buyerA");
  buyerB = await mk("buyerB");
});
afterAll(async () => {
  const ids = [owner._id, buyerA._id, buyerB._id];
  await PriceAlert.deleteMany({ user: { $in: ids } });
  await Notification.deleteMany({ recipient: { $in: ids } });
  await PropertyPost.deleteMany({ author: owner._id });
  await User.deleteMany({ _id: { $in: ids } });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await PriceAlert.deleteMany({ user: { $in: [buyerA._id, buyerB._id] } });
  await Notification.deleteMany({ recipient: { $in: [buyerA._id, buyerB._id] } });
  await PropertyPost.deleteMany({ author: owner._id });
  post = await PropertyPost.create({
    author: owner._id, title: "Alert flat", price: 6000000,
    status: "PUBLISHED", visibility: "PUBLIC", listingType: "Sell",
  });
});

describe("price alert — set / get / remove", () => {
  it("sets an alert below the current price", async () => {
    const { alert, watcherCount } = await setAlert(buyerA._id, String(post._id), 5500000);
    expect(alert.targetPrice).toBe(5500000);
    expect(alert.active).toBe(true);
    expect(watcherCount).toBe(1);
  });

  it("rejects a target at or above the current price", async () => {
    await expect(setAlert(buyerA._id, String(post._id), 6000000)).rejects.toMatchObject({ statusCode: 400 });
    await expect(setAlert(buyerA._id, String(post._id), 7000000)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an invalid target and the owner's own listing", async () => {
    await expect(setAlert(buyerA._id, String(post._id), -1)).rejects.toMatchObject({ statusCode: 400 });
    await expect(setAlert(buyerA._id, String(post._id), "abc")).rejects.toMatchObject({ statusCode: 400 });
    await expect(setAlert(owner._id, String(post._id), 5000000)).rejects.toMatchObject({ statusCode: 400 });
  });

  it("re-setting updates the target and clears the throttle", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    await PriceAlert.updateOne({ user: buyerA._id, post: post._id }, { $set: { lastNotifiedPrice: 5500000, lastNotifiedAt: new Date() } });
    const { alert } = await setAlert(buyerA._id, String(post._id), 5000000);
    expect(alert.targetPrice).toBe(5000000);
    const fresh = await PriceAlert.findOne({ user: buyerA._id, post: post._id }).lean();
    expect(fresh.lastNotifiedPrice).toBeNull();
  });

  it("removes (deactivates) an alert", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    const { watcherCount } = await removeAlert(buyerA._id, String(post._id));
    expect(watcherCount).toBe(0);
    const got = await getMyAlert(buyerA._id, String(post._id));
    expect(got.alert).toBeNull();
  });

  it("lists my active alerts with the post attached and a `met` flag", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    const list = await listMyAlerts(buyerA._id);
    expect(list).toHaveLength(1);
    expect(list[0].post.id).toBe(String(post._id));
    expect(list[0].post.met).toBe(false);
  });
});

describe("price alert — trigger on drop", () => {
  it("notifies when the new price meets the target, once", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    await setAlert(buyerB._id, String(post._id), 4000000); // not met

    post.price = 5400000;
    const notified = await notifyTriggeredAlerts(post, 6000000);
    expect(notified).toEqual([String(buyerA._id)]);

    const aNotes = await Notification.find({ recipient: buyerA._id, type: "price_alert" }).lean();
    expect(aNotes).toHaveLength(1);
    expect(aNotes[0].priceAfter).toBe(5400000);
    const bNotes = await Notification.find({ recipient: buyerB._id, type: "price_alert" }).lean();
    expect(bNotes).toHaveLength(0);

    // same price again -> no repeat
    const again = await notifyTriggeredAlerts(post, 5400000);
    expect(again).toEqual([]);
  });

  it("re-notifies only when the price falls further", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    post.price = 5400000;
    await notifyTriggeredAlerts(post, 6000000);
    post.price = 5000000;
    const notified = await notifyTriggeredAlerts(post, 5400000);
    expect(notified).toEqual([String(buyerA._id)]);
    expect(await Notification.countDocuments({ recipient: buyerA._id, type: "price_alert" })).toBe(2);
  });

  it("does not fire on a price increase", async () => {
    await setAlert(buyerA._id, String(post._id), 5500000);
    post.price = 6500000;
    expect(await notifyTriggeredAlerts(post, 6000000)).toEqual([]);
  });
});

describe("generic price-drop fan-out hardening", () => {
  it("ignores a trivial drop", async () => {
    post.likedBy = [buyerA._id];
    post.price = 5990000; // 0.17% drop, < ₹50k
    await notifyPriceChange(post, 6000000);
    expect(await Notification.countDocuments({ recipient: buyerA._id, type: "price_drop" })).toBe(0);
  });

  it("sends on a meaningful drop and respects the cooldown", async () => {
    post.savedBy = [buyerA._id];
    post.price = 5500000; // ₹5L / 8.3% drop
    await notifyPriceChange(post, 6000000);
    expect(await Notification.countDocuments({ recipient: buyerA._id, type: "price_drop" })).toBe(1);

    const fresh = await PropertyPost.findById(post._id).lean();
    expect(fresh.lastPriceDropNotifyAt).toBeTruthy();

    // second drop within cooldown -> suppressed
    post.lastPriceDropNotifyAt = fresh.lastPriceDropNotifyAt;
    post.price = 5000000;
    await notifyPriceChange(post, 5500000);
    expect(await Notification.countDocuments({ recipient: buyerA._id, type: "price_drop" })).toBe(1);
  });

  it("skips users who have their own active alert", async () => {
    await setAlert(buyerA._id, String(post._id), 5000000);
    post.savedBy = [buyerA._id, buyerB._id];
    post.price = 5400000;
    await notifyPriceChange(post, 6000000);
    expect(await Notification.countDocuments({ recipient: buyerA._id, type: "price_drop" })).toBe(0);
    expect(await Notification.countDocuments({ recipient: buyerB._id, type: "price_drop" })).toBe(1);
  });
});
