import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import PersonalizationService from "../src/services/PersonalizationService.js";

// Mumbai vs a point ~1200 km away (Delhi) — far outside the 150 km retrieval
// radius, so a Mumbai user should never see the Delhi fixtures.
const MUM = { lat: 19.076, lon: 72.8777 };
const DEL = { lat: 28.7041, lon: 77.1025 };
const kmToDeg = (km) => km / 111;

let mumbaiUser, cityOnlyUser, noLocationUser, author;
const tag = `reco-geo-${Date.now()}`;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  await PropertyPost.syncIndexes();

  author = await User.create({
    fullName: "Reco Author", email: `${tag}-author@t.test`, password: "TestPass1!", isVerified: true,
  });
  mumbaiUser = await User.create({
    fullName: "Reco Mumbai", email: `${tag}-mum@t.test`, password: "TestPass1!", isVerified: true,
    city: "Mumbai",
    locationDetails: { latitude: MUM.lat, longitude: MUM.lon, city: "Mumbai", source: "gps", capturedAt: new Date() },
  });
  cityOnlyUser = await User.create({
    fullName: "Reco CityOnly", email: `${tag}-city@t.test`, password: "TestPass1!", isVerified: true, city: "Mumbai",
  });
  noLocationUser = await User.create({
    fullName: "Reco NoLoc", email: `${tag}-noloc@t.test`, password: "TestPass1!", isVerified: true,
  });

  const mk = (title, at, dLatKm = 0) => PropertyPost.create({
    author: author._id, title: `${tag} ${title}`, price: 5000000, status: "PUBLISHED", visibility: "PUBLIC",
    propertyType: "Apartment", postType: "PROPERTY_SALE",
    latitude: at.lat + kmToDeg(dLatKm), longitude: at.lon, mediaUrls: ["x.jpg"],
    city: at === MUM ? "Mumbai" : "Delhi",
  });

  await mk("Mumbai A", MUM, 2);
  await mk("Mumbai B", MUM, 8);
  await mk("Mumbai C", MUM, 20);
  await mk("Delhi A", DEL, 2);
  await mk("Delhi B", DEL, 8);
});

afterAll(async () => {
  await PropertyPost.deleteMany({ author: author._id });
  await User.deleteMany({ _id: { $in: [author._id, mumbaiUser._id, cityOnlyUser._id, noLocationUser._id] } });
  await mongoose.disconnect();
});

const mine = (pool) => pool.filter((p) => p.title.startsWith(tag)).map((p) => p.title.replace(`${tag} `, ""));

describe("recommendation retrieval — location gate", () => {
  it("a GPS user only gets candidates within the radius", async () => {
    const { pool, strategy } = await PersonalizationService.getRecommendationCandidates(
      String(mumbaiUser._id), mumbaiUser.toObject(), 3
    );
    const titles = mine(pool);
    expect(strategy).toMatch(/^geo:gps|city$/);
    expect(titles).toEqual(expect.arrayContaining(["Mumbai A", "Mumbai B", "Mumbai C"]));
    expect(titles).not.toContain("Delhi A");
    expect(titles).not.toContain("Delhi B");
  });

  it("a city-only user is centred on the city centroid", async () => {
    const { pool, strategy } = await PersonalizationService.getRecommendationCandidates(
      String(cityOnlyUser._id), cityOnlyUser.toObject(), 3
    );
    const titles = mine(pool);
    expect(strategy).toMatch(/^geo:city|city$/);
    expect(titles).toContain("Mumbai A");
    expect(titles).not.toContain("Delhi A");
  });

  it("a user with no location at all falls through to the whole catalogue", async () => {
    const { pool, strategy } = await PersonalizationService.getRecommendationCandidates(
      String(noLocationUser._id), noLocationUser.toObject(), 3
    );
    expect(strategy).toBe("national");
    // both cities present — nothing to gate on
    const titles = mine(pool);
    expect(titles).toContain("Mumbai A");
    expect(titles).toContain("Delhi A");
  });

  it("excludes the user's own listings", async () => {
    const { pool } = await PersonalizationService.getRecommendationCandidates(
      String(author._id), author.toObject(), 3
    );
    expect(pool.some((p) => String(p.author?._id || p.author) === String(author._id))).toBe(false);
  });
});
