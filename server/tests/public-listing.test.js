import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { getListingSharePreview, recordListingShare } from "../src/modules/public-listing/publicListing.controller.js";

function fakeRes() {
  return {
    headers: {},
    set(k, v) { this.headers[String(k).toLowerCase()] = v; return this; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}
const run = (handler, req) => {
  const res = fakeRes();
  let captured;
  return Promise.resolve(handler(req, res, (err) => { captured = err; })).then(() => {
    if (captured) throw captured;
    return res;
  });
};

let owner, published, draft, deleted;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await User.create({ fullName: "Share Owner", email: `share-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true, profilePic: "http://x/a.jpg" });
});
afterAll(async () => {
  await PropertyPost.deleteMany({ author: owner._id });
  await User.deleteMany({ _id: owner._id });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await PropertyPost.deleteMany({ author: owner._id });
  published = await PropertyPost.create({
    author: owner._id, title: "Sunny 2BHK", caption: "Great light, quiet street",
    postType: "PROPERTY_SALE", propertyType: "Apartment", city: "Indore", locality: "Vijay Nagar",
    price: 6500000, bedrooms: 2, bathrooms: 2, areaSqft: 1150,
    mediaUrls: ["http://img/1.jpg", "http://img/2.jpg"],
    status: "PUBLISHED", visibility: "PUBLIC",
  });
  draft = await PropertyPost.create({ author: owner._id, title: "Draft flat", price: 100, status: "DRAFT", visibility: "PUBLIC" });
  deleted = await PropertyPost.create({ author: owner._id, title: "Gone", price: 100, status: "PUBLISHED", visibility: "PUBLIC", isDeleted: true });
});

describe("public listing share preview", () => {
  it("returns a preview for a published public listing", async () => {
    const res = await run(getListingSharePreview, { params: { id: String(published._id) } });
    expect(res.statusCode).toBe(200);
    const l = res.body.data.listing;
    expect(l.title).toBe("Sunny 2BHK");
    expect(l.priceLabel).toBe("₹65 L");
    expect(l.locationLabel).toBe("Vijay Nagar, Indore");
    expect(l.specsLabel).toContain("2 BHK");
    expect(l.coverImage).toBe("http://img/1.jpg");
    expect(l.canonicalUrl).toMatch(/\/p\/[a-f0-9]{24}$/);
    expect(l.appUrl).toMatch(/\/property\/[a-f0-9]{24}$/);
    expect(l.author.name).toBe("Share Owner");
    expect(res.headers["cache-control"]).toContain("max-age");
  });

  it("rent listings get a /mo price label", async () => {
    published.postType = "PROPERTY_RENT";
    published.price = 25000;
    await published.save();
    const res = await run(getListingSharePreview, { params: { id: String(published._id) } });
    expect(res.body.data.listing.priceLabel).toBe("₹25,000/mo");
  });

  it("404s on a draft listing", async () => {
    await expect(run(getListingSharePreview, { params: { id: String(draft._id) } })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s on a deleted listing", async () => {
    await expect(run(getListingSharePreview, { params: { id: String(deleted._id) } })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("404s on a malformed id", async () => {
    await expect(run(getListingSharePreview, { params: { id: "not-an-id" } })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("share counter increments and never throws", async () => {
    const res = await run(recordListingShare, { params: { id: String(published._id) } });
    expect(res.statusCode).toBe(202);
    const fresh = await PropertyPost.findById(published._id).lean();
    expect(fresh.shareCount).toBe(1);
    // bad id is swallowed
    const res2 = await run(recordListingShare, { params: { id: "nope" } });
    expect(res2.statusCode).toBe(202);
  });
});
