import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { getPropertyFeed } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return {
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

let viewer, author, cheap, mid, expensive, gymOnly, poolOnly, both, neither;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

  viewer = await User.create({
    fullName: "Filter Viewer",
    email: `filter-viewer-${Date.now()}@t.test`,
    password: "TestPass1!",
    isVerified: true,
  });
  author = await User.create({
    fullName: "Filter Author",
    email: `filter-author-${Date.now()}@t.test`,
    password: "TestPass1!",
    isVerified: true,
  });

  const mk = (title, price, extra = {}) =>
    PropertyPost.create({
      author: author._id,
      title,
      price,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      mediaUrls: ["x.jpg"],
      ...extra,
    });

  cheap = await mk("Cheap flat", 500000);
  mid = await mk("Mid flat", 2000000);
  expensive = await mk("Expensive flat", 9000000);
  gymOnly = await mk("Gym building", 1000000, { postMeta: { amenities: ["Gym"] } });
  poolOnly = await mk("Pool building", 1000000, { postMeta: { amenities: ["Swimming Pool"] } });
  both = await mk("Gym and pool building", 1000000, { postMeta: { amenities: ["Gym", "Swimming Pool"] } });
  neither = await mk("Plain building", 1000000);
});

afterAll(async () => {
  await PropertyPost.deleteMany({ author: author._id });
  await User.deleteMany({ _id: { $in: [viewer._id, author._id] } });
  await mongoose.disconnect();
});

async function feed(query) {
  const res = fakeRes();
  await getPropertyFeed({ query: { limit: 50, ...query }, user: viewer }, res);
  return res;
}

describe("GET /posts — price range filter", () => {
  it("returns only posts at or above priceMin", async () => {
    const res = await feed({ priceMin: 1000000 });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).not.toContain("Cheap flat");
    expect(titles).toContain("Mid flat");
    expect(titles).toContain("Expensive flat");
  });

  it("returns only posts at or below priceMax", async () => {
    const res = await feed({ priceMax: 2000000 });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toContain("Cheap flat");
    expect(titles).toContain("Mid flat");
    expect(titles).not.toContain("Expensive flat");
  });

  it("combines priceMin and priceMax into a range", async () => {
    const res = await feed({ priceMin: 1000000, priceMax: 3000000 });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).not.toContain("Cheap flat");
    expect(titles).toContain("Mid flat");
    expect(titles).not.toContain("Expensive flat");
  });

  it("ignores an invalid/non-numeric priceMin rather than erroring", async () => {
    const res = await feed({ priceMin: "not-a-number" });
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /posts — propertyType filter", () => {
  it("still matches a single value exactly, unchanged", async () => {
    const res = await feed({ propertyType: "Apartment" });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toContain("Cheap flat");
  });

  it("matches any type in a comma-separated multi-select", async () => {
    const villa = await PropertyPost.create({
      author: author._id,
      title: "Villa listing",
      price: 1000000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      mediaUrls: ["x.jpg"],
      propertyType: "Villa",
    });
    try {
      const res = await feed({ propertyType: "Apartment,Villa" });
      const titles = res.body.data.posts.map((p) => p.title);
      expect(titles).toContain("Cheap flat");
      expect(titles).toContain("Villa listing");
    } finally {
      await PropertyPost.deleteOne({ _id: villa._id });
    }
  });
});

describe("GET /posts — amenities filter", () => {
  it("matches posts having any of the requested amenities", async () => {
    const res = await feed({ amenities: "Gym" });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toContain("Gym building");
    expect(titles).toContain("Gym and pool building");
    expect(titles).not.toContain("Pool building");
    expect(titles).not.toContain("Plain building");
  });

  it("matches on any amenity in a comma-separated list", async () => {
    const res = await feed({ amenities: "Gym,Swimming Pool" });
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toContain("Gym building");
    expect(titles).toContain("Pool building");
    expect(titles).toContain("Gym and pool building");
    expect(titles).not.toContain("Plain building");
  });
});
