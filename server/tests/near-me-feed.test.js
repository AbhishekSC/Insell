import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { getPropertyFeed } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
// Mumbai reference point
const MUM = { lat: 19.076, lon: 72.8777 };
const kmToDeg = (km) => km / 111;

let viewer, other, near2km, near12km, far60km, sold, coordless;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  await PropertyPost.syncIndexes();

  viewer = await User.create({
    fullName: "NM Viewer", email: `nm-viewer-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true,
    city: "Mumbai",
    locationDetails: { latitude: MUM.lat, longitude: MUM.lon, city: "Mumbai", capturedAt: new Date() },
  });
  other = await User.create({ fullName: "NM Other", email: `nm-other-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true });

  const mk = (title, dLatKm, extra = {}) => PropertyPost.create({
    author: other._id, title, price: 1000000, status: "PUBLISHED", visibility: "PUBLIC",
    latitude: MUM.lat + kmToDeg(dLatKm), longitude: MUM.lon, mediaUrls: ["x.jpg"], ...extra,
  });
  near2km = await mk("Near 2km", 2);
  near12km = await mk("Near 12km", 12);
  far60km = await mk("Far 60km", 60);
  sold = await mk("Sold nearby", 3, { offerStatus: "ACCEPTED" });
  coordless = await PropertyPost.create({ author: other._id, title: "Coordless Mumbai", price: 1000000, status: "PUBLISHED", city: "Mumbai" });
});

afterAll(async () => {
  await PropertyPost.deleteMany({ author: other._id });
  await User.deleteMany({ _id: { $in: [viewer._id, other._id] } });
  await mongoose.disconnect();
});

async function feed(query) {
  const res = fakeRes();
  await getPropertyFeed({ query: { category: "near me", ...query }, user: viewer }, res);
  return res;
}

describe("Near Me feed — geo path", () => {
  it("returns posts sorted by distance, closest first, with a distanceKm", async () => {
    const res = await feed({ lat: MUM.lat, lon: MUM.lon, limit: 50 });
    expect(res.statusCode).toBe(200);
    const titles = res.body.data.posts.map((p) => p.title);
    expect(titles).toContain("Near 2km");
    expect(titles).toContain("Near 12km");
    expect(titles.indexOf("Near 2km")).toBeLessThan(titles.indexOf("Near 12km"));
    const p = res.body.data.posts.find((x) => x.title === "Near 2km");
    expect(p.distanceKm).toBeGreaterThan(0);
    expect(p.distanceKm).toBeLessThan(5);
    expect(res.body.data.meta.nearMe.mode).toBe("geo");
  });

  it("excludes sold/rented listings", async () => {
    const res = await feed({ lat: MUM.lat, lon: MUM.lon, limit: 50 });
    expect(res.body.data.posts.map((p) => p.title)).not.toContain("Sold nearby");
  });

  it("includes a post 60km out but not beyond 100km, and reports the radius used", async () => {
    const res = await feed({ lat: MUM.lat, lon: MUM.lon, limit: 50 });
    expect(res.body.data.posts.map((p) => p.title)).toContain("Far 60km");
    expect(res.body.data.meta.nearMe.radiusKm).toBeGreaterThanOrEqual(60);
  });

  it("prefers fresh GPS from the request over the saved location", async () => {
    // Point the GPS at Delhi — nothing should be within 100km
    const res = await feed({ lat: 28.7041, lon: 77.1025, limit: 50 });
    expect(res.body.data.posts.length).toBe(0);
    expect(res.body.data.meta.nearMe.mode).toBe("geo");
  });
});

describe("Near Me feed — fallback", () => {
  it("uses the city centroid as the geo point when the user has only a city", async () => {
    const cityOnlyUser = await User.create({
      fullName: "City Only", email: `nm-city-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true, city: "Mumbai",
    });
    const res = fakeRes();
    await getPropertyFeed({ query: { category: "near me" }, user: cityOnlyUser }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.nearMe.mode).toBe("geo");
    expect(res.body.data.meta.nearMe.pointSource).toBe("city");
    expect(res.body.data.posts.some((p) => p.title === "Near 2km")).toBe(true);
    await User.deleteOne({ _id: cityOnlyUser._id });
  });

  it("falls back to city-string match when the city isn't in the centroid table", async () => {
    const oddCityUser = await User.create({
      fullName: "Odd City", email: `nm-odd-${Date.now()}@t.test`, password: "TestPass1!", isVerified: true, city: "Mumbai",
    });
    // give the coordless Mumbai post a distinctive city so we can target it
    await PropertyPost.updateOne({ _id: coordless._id }, { $set: { city: "Zzville" } });
    oddCityUser.city = "Zzville";
    await oddCityUser.save();
    const res = fakeRes();
    await getPropertyFeed({ query: { category: "near me" }, user: oddCityUser }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.meta.nearMe.mode).toBe("city");
    expect(res.body.data.posts.some((p) => p.title === "Coordless Mumbai")).toBe(true);
    await User.deleteOne({ _id: oddCityUser._id });
  });
});
