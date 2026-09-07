import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import SavedSearch from "../src/models/SavedSearch.model.js";
import Notification from "../src/models/Notification.model.js";
import {
  createSearch,
  listMySearches,
  updateSearch,
  deleteSearch,
  matchesPost,
  notifyMatches,
} from "../src/modules/saved-search/savedSearch.app.service.js";

const mk = (s) =>
  User.create({ fullName: `SS ${s}`, email: `ss-${s}-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

let buyer, seller;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  buyer = await mk("buyer");
  seller = await mk("seller");
});
afterAll(async () => {
  await SavedSearch.deleteMany({ user: { $in: [buyer._id, seller._id] } });
  await Notification.deleteMany({ recipient: { $in: [buyer._id, seller._id] } });
  await PropertyPost.deleteMany({ author: seller._id });
  await User.deleteMany({ _id: { $in: [buyer._id, seller._id] } });
  await mongoose.disconnect();
});
beforeEach(async () => {
  await SavedSearch.deleteMany({ user: { $in: [buyer._id, seller._id] } });
  await Notification.deleteMany({ recipient: { $in: [buyer._id, seller._id] } });
  await PropertyPost.deleteMany({ author: seller._id });
});

describe("saved search CRUD", () => {
  it("creates a search with an auto label and lists it", async () => {
    const s = await createSearch(buyer._id, { city: "Indore", locality: "Vijay Nagar", minBedrooms: 2, maxPrice: 6000000, postType: ["PROPERTY_SALE"] });
    expect(s.label).toContain("Vijay Nagar");
    expect(s.filters.maxPrice).toBe(6000000);
    const list = await listMySearches(buyer._id);
    expect(list).toHaveLength(1);
  });

  it("rejects an empty filter set and an inverted price range", async () => {
    await expect(createSearch(buyer._id, {})).rejects.toMatchObject({ statusCode: 400 });
    await expect(createSearch(buyer._id, { minPrice: 9000000, maxPrice: 100000 })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("re-saving the same filters updates rather than duplicates", async () => {
    await createSearch(buyer._id, { city: "Indore", minBedrooms: 2 });
    await createSearch(buyer._id, { city: "Indore", minBedrooms: 2 }, "renamed");
    const list = await listMySearches(buyer._id);
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("renamed");
  });

  it("toggles active and deletes", async () => {
    const s = await createSearch(buyer._id, { city: "Indore" });
    const off = await updateSearch(buyer._id, s.id, { active: false });
    expect(off.active).toBe(false);
    await deleteSearch(buyer._id, s.id);
    expect(await listMySearches(buyer._id)).toHaveLength(0);
  });
});

describe("matchesPost predicate", () => {
  const post = {
    postType: "PROPERTY_SALE", city: "Indore", locality: "Vijay Nagar",
    propertyType: "Apartment", bedrooms: 3, price: 5500000,
  };
  const S = (filters) => ({ filters });

  it("matches when all set filters agree", () => {
    expect(matchesPost(S({ city: "indore", minBedrooms: 2, maxPrice: 6000000, postType: ["PROPERTY_SALE"] }), post)).toBe(true);
  });
  it("fails on city / locality / type / price / bedrooms mismatch", () => {
    expect(matchesPost(S({ city: "Bhopal" }), post)).toBe(false);
    expect(matchesPost(S({ locality: "Sudama Nagar" }), post)).toBe(false);
    expect(matchesPost(S({ postType: ["PROPERTY_RENT"] }), post)).toBe(false);
    expect(matchesPost(S({ maxPrice: 5000000 }), post)).toBe(false);
    expect(matchesPost(S({ minBedrooms: 4 }), post)).toBe(false);
    expect(matchesPost(S({ propertyType: "Villa" }), post)).toBe(false);
  });
  it("an empty filter set matches anything", () => {
    expect(matchesPost(S({}), post)).toBe(true);
  });
});

describe("notifyMatches", () => {
  const publish = (over = {}) =>
    PropertyPost.create({
      author: seller._id, title: "Bright 2BHK", postType: "PROPERTY_SALE",
      propertyType: "Apartment", city: "Indore", locality: "Vijay Nagar",
      price: 5500000, bedrooms: 2, status: "PUBLISHED", visibility: "PUBLIC", ...over,
    });

  it("notifies the owner of a matching search, once", async () => {
    await createSearch(buyer._id, { city: "Indore", locality: "Vijay Nagar", maxPrice: 6000000 });
    const post = await publish();
    await notifyMatches({ ...post.toObject(), author: seller._id });

    const notes = await Notification.find({ recipient: buyer._id, type: "saved_search_match" }).lean();
    expect(notes).toHaveLength(1);
    expect(String(notes[0].propertyPost)).toBe(String(post._id));

    const fresh = await SavedSearch.findOne({ user: buyer._id }).lean();
    expect(fresh.matchCount).toBe(1);

    // cooldown — a second matching post right away doesn't re-notify
    const post2 = await publish({ title: "Another 2BHK" });
    await notifyMatches({ ...post2.toObject(), author: seller._id });
    expect(await Notification.countDocuments({ recipient: buyer._id, type: "saved_search_match" })).toBe(1);
  });

  it("does not notify the poster about their own saved search", async () => {
    await createSearch(seller._id, { city: "Indore" });
    const post = await publish();
    await notifyMatches({ ...post.toObject(), author: seller._id });
    expect(await Notification.countDocuments({ recipient: seller._id, type: "saved_search_match" })).toBe(0);
  });

  it("ignores a non-published post", async () => {
    await createSearch(buyer._id, { city: "Indore" });
    const post = await publish({ status: "DRAFT" });
    await notifyMatches({ ...post.toObject(), author: seller._id });
    expect(await Notification.countDocuments({ recipient: buyer._id, type: "saved_search_match" })).toBe(0);
  });

  it("does not notify an inactive search", async () => {
    const s = await createSearch(buyer._id, { city: "Indore" });
    await updateSearch(buyer._id, s.id, { active: false });
    const post = await publish();
    await notifyMatches({ ...post.toObject(), author: seller._id });
    expect(await Notification.countDocuments({ recipient: buyer._id, type: "saved_search_match" })).toBe(0);
  });
});
