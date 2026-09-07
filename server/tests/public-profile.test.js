import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { getPublicProfile } from "../src/modules/public-profile/publicProfile.app.service.js";
import { renderProfileSharePage } from "../src/modules/public-profile/publicProfile.controller.js";

function fakeRes() {
  return {
    headers: {},
    set(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    send(b) { this._body = b; return this; },
  };
}
const run = (handler, req) => {
  const res = fakeRes();
  let captured;
  return Promise.resolve(handler(req, res, (e) => { captured = e; })).then(() => {
    if (captured) throw captured;
    return res;
  });
};

const mk = (s, extra = {}) =>
  User.create({ fullName: `PP ${s}`, email: `pp-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true, ...extra });

let owner, other;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await mk("owner", { city: "Indore", bio: "Sells flats", profilePic: "http://x/a.jpg", friends: [] });
  other = await mk("other", { city: "Indore", isVerified: true });
});
afterAll(async () => {
  await PropertyPost.deleteMany({ author: owner._id });
  await User.deleteMany({ _id: { $in: [owner._id, other._id] } });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await PropertyPost.deleteMany({ author: owner._id });
});

async function seedPosts(n, over = {}) {
  const docs = [];
  for (let i = 0; i < n; i++) {
    docs.push({
      author: owner._id, title: `Flat ${i}`, price: 5000000 + i, postType: "PROPERTY_SALE",
      city: "Indore", locality: "Vijay Nagar", mediaUrls: [`http://img/${i}.jpg`],
      status: "PUBLISHED", visibility: "PUBLIC", ...over,
    });
  }
  return PropertyPost.insertMany(docs);
}

describe("public profile", () => {
  it("returns the header, first 5 posts, count, and related", async () => {
    await seedPosts(8);
    const p = await getPublicProfile(String(owner._id));
    expect(p.name).toBe(owner.fullName);
    expect(p.bio).toBe("Sells flats");
    expect(p.postsCount).toBe(8);
    expect(p.previewPosts).toHaveLength(5);
    expect(p.hasMorePosts).toBe(true);
    expect(p.previewPosts[0].priceLabel).toMatch(/₹/);
    expect(p.related.some((r) => r.id === String(other._id))).toBe(true);
    expect(p.related.every((r) => r.id !== String(owner._id))).toBe(true);
  });

  it("hasMorePosts is false with <=5 posts", async () => {
    await seedPosts(3);
    const p = await getPublicProfile(String(owner._id));
    expect(p.previewPosts).toHaveLength(3);
    expect(p.hasMorePosts).toBe(false);
  });

  it("excludes drafts, deleted and blocked listings from the count", async () => {
    await seedPosts(2);
    await seedPosts(1, { status: "DRAFT" });
    await seedPosts(1, { isDeleted: true });
    await seedPosts(1, { isBlocked: true });
    const p = await getPublicProfile(String(owner._id));
    expect(p.postsCount).toBe(2);
  });

  it("prefers a non-video cover image", async () => {
    await PropertyPost.create({
      author: owner._id, title: "Vid first", price: 100000, postType: "PROPERTY_RENT",
      city: "Indore", status: "PUBLISHED", visibility: "PUBLIC",
      mediaUrls: ["https://res.cloudinary.com/x/video/upload/v1/clip.mov", "https://img/real.jpg"],
    });
    const p = await getPublicProfile(String(owner._id));
    expect(p.previewPosts[0].coverImage).toBe("https://img/real.jpg");
    expect(p.previewPosts[0].priceLabel).toContain("/mo");
  });

  it("404s on a bad or missing id", async () => {
    await expect(getPublicProfile("not-an-id")).rejects.toMatchObject({ statusCode: 404 });
    await expect(getPublicProfile("6a9999999999999999999999")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("renders an HTML share page with profile OG tags", async () => {
    await seedPosts(6);
    const res = await run(renderProfileSharePage, { params: { id: String(owner._id) } });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res._body).toContain('property="og:type" content="profile"');
    expect(res._body).toContain(owner.fullName);
    expect(res._body).toContain("/users/" + String(owner._id));
  });

  it("renders a 404 HTML page for a missing profile", async () => {
    const res = await run(renderProfileSharePage, { params: { id: "6a9999999999999999999999" } });
    expect(res.statusCode).toBe(404);
    expect(res._body).toContain("isn't available");
  });
});
