import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { getSimilarProperties } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return {
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

let owner, other, ref, near, farAway;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  owner = await User.create({ fullName: "Sim Owner", email: `sim-owner-${Date.now()}@example.test`, password: "TestPass1!", isVerified: true });
  other = await User.create({ fullName: "Sim Other", email: `sim-other-${Date.now()}@example.test`, password: "TestPass1!", isVerified: true });

  ref = await PropertyPost.create({
    author: owner._id, postType: "PROPERTY_SALE", propertyType: "Apartment",
    title: "Ref 3BHK", city: "Indore", locality: "Vijay Nagar", price: 8000000, bedrooms: 3, status: "PUBLISHED",
  });
  near = await PropertyPost.create({
    author: other._id, postType: "PROPERTY_SALE", propertyType: "Apartment",
    title: "Near 3BHK", city: "Indore", locality: "Vijay Nagar", price: 8300000, bedrooms: 3, status: "PUBLISHED",
  });
  farAway = await PropertyPost.create({
    author: other._id, postType: "PROPERTY_RENT", propertyType: "Commercial",
    title: "Unrelated shop", city: "Chennai", locality: "T Nagar", price: 25000, status: "PUBLISHED",
  });
});

afterAll(async () => {
  await PropertyPost.deleteMany({ author: { $in: [owner._id, other._id] } });
  await User.deleteMany({ _id: { $in: [owner._id, other._id] } });
  await mongoose.disconnect();
});

describe("getSimilarProperties", () => {
  it("returns the closely-matching post ahead of the unrelated one, and never the reference itself", async () => {
    const res = fakeRes();
    await getSimilarProperties({ params: { id: String(ref._id) }, query: {}, user: owner }, res);

    expect(res.statusCode).toBe(200);
    const posts = res.body.data.posts;
    const ids = posts.map((p) => String(p._id));

    expect(ids).not.toContain(String(ref._id));
    expect(ids).toContain(String(near._id));

    const nearRank = ids.indexOf(String(near._id));
    const farRank = ids.indexOf(String(farAway._id));
    if (farRank !== -1) expect(nearRank).toBeLessThan(farRank);

    const nearDoc = posts.find((p) => String(p._id) === String(near._id));
    expect(nearDoc.similarityScore).toBeGreaterThan(0);
  });

  it("404s for a missing post", async () => {
    const res = fakeRes();
    await getSimilarProperties({ params: { id: new mongoose.Types.ObjectId().toString() }, query: {}, user: owner }, res);
    expect(res.statusCode).toBe(404);
  });
});
