import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import PersonalizationService from "../src/services/PersonalizationService.js";

// A deliberately remote, isolated point (Andaman) so a pool built here is
// exactly our fixtures — nothing real should also live within 60km of it.
const NEAR = { lat: 11.62, lon: 92.72 };
const kmToDeg = (km) => km / 111;

let viewer;
let authors = [];
const tag = `trending-near-${Date.now()}`;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  await PropertyPost.syncIndexes();

  // A distinct author per listing — authorCap (max 2 per author) would
  // otherwise wipe out most of a single-author fixture set and make the
  // tests about that cap instead of about the signal being tested.
  authors = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      User.create({ fullName: `Trending Author ${i}`, email: `${tag}-author${i}@t.test`, password: "TestPass1!", isVerified: true })
    )
  );
  let nextAuthor = 0;
  const freshAuthor = () => authors[nextAuthor++];

  viewer = await User.create({
    fullName: "Trending Viewer", email: `${tag}-viewer@t.test`, password: "TestPass1!", isVerified: true,
    city: "Andaman",
    locationDetails: { latitude: NEAR.lat, longitude: NEAR.lon, city: "Andaman", source: "gps", capturedAt: new Date() },
  });

  const mk = (title, { dLatKm = 0, likes = 0, saves = 0, ageDays = 0, propertyType = "Apartment", author } = {}) =>
    PropertyPost.create({
      author: (author || freshAuthor())._id,
      title: `${tag} ${title}`,
      price: 5000000,
      status: "PUBLISHED",
      visibility: "PUBLIC",
      propertyType,
      postType: "PROPERTY_SALE",
      latitude: NEAR.lat + kmToDeg(dLatKm),
      longitude: NEAR.lon,
      mediaUrls: ["x.jpg"],
      city: "Andaman",
      likedBy: Array.from({ length: likes }, () => new mongoose.Types.ObjectId()),
      savedBy: Array.from({ length: saves }, () => new mongoose.Types.ObjectId()),
      createdAt: new Date(Date.now() - ageDays * 24 * 60 * 60 * 1000),
    });

  await mk("Close and hot", { dLatKm: 1, likes: 20, saves: 10, ageDays: 1 });
  await mk("Close but stale", { dLatKm: 1, likes: 0, saves: 0, ageDays: 60 });
  await mk("Far and hot", { dLatKm: 50, likes: 20, saves: 10, ageDays: 1 });
  await mk("Own listing nearby", { dLatKm: 1, likes: 20, saves: 10, ageDays: 1, author: viewer });
  // 8 unrelated listings of a DIFFERENT type so the diversity-cap test below
  // has something to cap without competing with the Apartment fixtures above.
  for (let i = 0; i < 8; i++) {
    await mk(`Filler ${i}`, { dLatKm: 2, likes: 1, ageDays: 10, propertyType: "Villa" });
  }
});

afterAll(async () => {
  await PropertyPost.deleteMany({ title: new RegExp(`^${tag}`) });
  await User.deleteMany({ _id: { $in: [...authors.map((a) => a._id), viewer._id] } });
  await mongoose.disconnect();
});

const mine = (properties) => properties.filter((p) => p.title.startsWith(tag)).map((p) => p.title.replace(`${tag} `, ""));

describe("getTrendingNearYou", () => {
  it("ranks a close, fast-engaging listing above a close-but-stale one", async () => {
    const { properties, source } = await PersonalizationService.getTrendingNearYou(String(viewer._id), { limit: 20 });
    const titles = mine(properties);
    expect(source).toMatch(/^geo:/);
    expect(titles.indexOf("Close and hot")).toBeLessThan(titles.indexOf("Close but stale"));
  });

  it("ranks a close listing above an equally-hot far one", async () => {
    const { properties } = await PersonalizationService.getTrendingNearYou(String(viewer._id), { limit: 20 });
    const titles = mine(properties);
    expect(titles.indexOf("Close and hot")).toBeLessThan(titles.indexOf("Far and hot"));
  });

  it("never surfaces the viewer's own listing", async () => {
    const { properties } = await PersonalizationService.getTrendingNearYou(String(viewer._id), { limit: 20 });
    expect(mine(properties)).not.toContain("Own listing nearby");
  });

  it("a fresh lat/lon passed in for this request overrides the saved location", async () => {
    // 1200km away — outside the 60km radius from the passed-in point, so
    // nothing from this fixture set should come back at all.
    const { properties, source } = await PersonalizationService.getTrendingNearYou(String(viewer._id), {
      lat: 28.7041,
      lon: 77.1025,
      limit: 20,
    });
    expect(source).toBe("geo:live");
    expect(mine(properties)).toHaveLength(0);
  });

  it("caps how many results share the same property type", async () => {
    // typeCap = max(3, ceil(limit/2)) = 5 for limit 8, well under the 8 Villa
    // fillers — confirms the cap actually trims rather than passing everything through.
    const { properties } = await PersonalizationService.getTrendingNearYou(String(viewer._id), { limit: 8 });
    const villas = properties.filter((p) => p.propertyType === "Villa" && p.title.startsWith(tag));
    expect(villas.length).toBeLessThanOrEqual(5);
    expect(villas.length).toBeGreaterThan(0);
  });

  it("returns a distance in km on each result when a geo point is used", async () => {
    const { properties } = await PersonalizationService.getTrendingNearYou(String(viewer._id), { limit: 20 });
    const hot = properties.find((p) => p.title === `${tag} Close and hot`);
    expect(hot.distanceKm).not.toBeNull();
    expect(hot.distanceKm).toBeLessThan(5);
  });
});
