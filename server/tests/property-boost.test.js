import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { boostPropertyPost, getPropertyFeed, expireBoostedPostsSweep } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(b) {
      this.body = b;
      return this;
    },
  };
}

describe("Property Post Boosting with Referral Coins", () => {
  let userWithCoins;
  let userWithoutCoins;
  let otherUser;
  let post;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

    userWithCoins = await User.create({
      fullName: "Rich Owner",
      email: `rich-owner-${Date.now()}@t.test`,
      password: "TestPass1!",
      isVerified: true,
      referralCredits: 2,
    });

    userWithoutCoins = await User.create({
      fullName: "Broke Owner",
      email: `broke-owner-${Date.now()}@t.test`,
      password: "TestPass1!",
      isVerified: true,
      referralCredits: 0,
    });

    otherUser = await User.create({
      fullName: "Random Stranger",
      email: `stranger-${Date.now()}@t.test`,
      password: "TestPass1!",
      isVerified: true,
      referralCredits: 5,
    });

    post = await PropertyPost.create({
      author: userWithCoins._id,
      title: "Penthouse with Sea View",
      price: 15000000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      mediaUrls: ["https://example.com/sea.jpg"],
    });
  });

  afterAll(async () => {
    await PropertyPost.deleteMany({ author: { $in: [userWithCoins._id, userWithoutCoins._id] } });
    await User.deleteMany({ _id: { $in: [userWithCoins._id, userWithoutCoins._id, otherUser._id] } });
  });

  it("fails if a stranger tries to boost someone else's property", async () => {
    const res = fakeRes();
    const req = {
      user: otherUser,
      params: { id: String(post._id) },
    };

    await boostPropertyPost(req, res);
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("own property");
  });

  it("fails if property post is blocked", async () => {
    const blockedPost = await PropertyPost.create({
      author: userWithCoins._id,
      title: "Blocked Luxury Villa",
      price: 50000000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isBlocked: true,
      mediaUrls: ["villa.jpg"],
    });

    const res = fakeRes();
    const req = {
      user: userWithCoins,
      params: { id: String(blockedPost._id) },
    };

    await boostPropertyPost(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("Cannot boost a blocked property listing");
  });

  it("fails if owner has 0 referral coins", async () => {
    const brokePost = await PropertyPost.create({
      author: userWithoutCoins._id,
      title: "Studio Flat",
      price: 20000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      mediaUrls: ["studio.jpg"],
    });

    const res = fakeRes();
    const req = {
      user: userWithoutCoins,
      params: { id: String(brokePost._id) },
    };

    await boostPropertyPost(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain("Insufficient referral coins");
  });

  it("successfully boosts property, deducts 1 coin, and sets 24h boost expiration", async () => {
    const res = fakeRes();
    const req = {
      user: userWithCoins,
      params: { id: String(post._id) },
    };

    await boostPropertyPost(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.post.isBoosted).toBe(true);
    expect(res.body.data.remainingCredits).toBe(1);

    const updatedUser = await User.findById(userWithCoins._id);
    expect(updatedUser.referralCredits).toBe(1);

    const updatedPost = await PropertyPost.findById(post._id);
    expect(updatedPost.isBoosted).toBe(true);
    expect(updatedPost.boostCount).toBe(1);
    expect(new Date(updatedPost.boostExpiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("boosted post appears as isBoosted: true in feed", async () => {
    const res = fakeRes();
    const req = {
      query: { q: "Penthouse with Sea View" },
      user: otherUser,
    };

    await getPropertyFeed(req, res);
    expect(res.statusCode).toBe(200);
    const found = res.body.data.posts.find((p) => String(p._id) === String(post._id));
    expect(found).toBeDefined();
    expect(found.isBoosted).toBe(true);
  });

  it("cleans up expired boosted posts while leaving active boosts alone", async () => {
    // Create an expired boosted post
    const expiredPost = await PropertyPost.create({
      author: userWithCoins._id,
      title: "Expired Boost Villa",
      price: 100000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      isBoosted: true,
      boostExpiresAt: new Date(Date.now() - 1000 * 60 * 60), // Expired 1 hour ago
      mediaUrls: ["expired.jpg"],
    });

    const res = fakeRes();
    const req = {
      get: (header) => (header === "x-cron-secret" ? (process.env.CRON_SECRET || "") : ""),
      query: {},
    };

    await expireBoostedPostsSweep(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.expiredCount).toBeGreaterThanOrEqual(1);

    // Verify expired post is now marked isBoosted: false
    const checkedExpired = await PropertyPost.findById(expiredPost._id);
    expect(checkedExpired.isBoosted).toBe(false);

    // Verify still active post is still isBoosted: true
    const checkedActive = await PropertyPost.findById(post._id);
    expect(checkedActive.isBoosted).toBe(true);

    await PropertyPost.deleteOne({ _id: expiredPost._id });
  });
});
