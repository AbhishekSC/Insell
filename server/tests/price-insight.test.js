import "dotenv/config";
import mongoose from "mongoose";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import User from "../src/models/User.model.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import Offer from "../src/models/Offer.model.js";
import { getPriceInsight, getCardSignals, getPriceSuggestion } from "../src/controllers/propertyPost.controller.js";

function fakeRes() {
  return { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

const tag = `price-insight-${Date.now()}`;
let author, subjectCheap, subjectPricey, thinCity, benchCity;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  author = await User.create({ fullName: "PI Author", email: `${tag}@t.test`, password: "TestPass1!", isVerified: true });

  benchCity = `PiCity${Date.now()}`;
  const mk = (price, areaSqft, extra = {}) => PropertyPost.create({
    author: author._id, title: `${tag} ${price}`, status: "PUBLISHED", visibility: "PUBLIC",
    city: benchCity, propertyType: "Apartment", postType: "PROPERTY_SALE", bedrooms: 2,
    price, areaSqft, ...extra,
  });

  // Comparable BUY set: ~₹10,000/sqft (1cr / 1000sqft)
  await Promise.all([mk(10000000, 1000), mk(10500000, 1000), mk(9500000, 1000), mk(10200000, 1020), mk(9800000, 980)]);
  subjectCheap = await mk(8000000, 1000); // ₹8,000/sqft — ~20% below
  subjectPricey = await mk(13000000, 1000); // ₹13,000/sqft — ~30% above

  // RENT listings in the same city/type — must NOT pollute the buy benchmark.
  await Promise.all([
    mk(25000, 1000, { listingType: "Rent" }),
    mk(30000, 1000, { listingType: "Rent" }),
    mk(28000, 1000, { listingType: "Rent" }),
    mk(32000, 1000, { listingType: "Rent" }),
    mk(27000, 1000, { listingType: "Rent" }),
  ]);

  const lonelyCity = `Lonelyville${Date.now()}`;
  thinCity = await PropertyPost.create({
    author: author._id, title: `${tag} lonely`, status: "PUBLISHED", visibility: "PUBLIC",
    city: lonelyCity, propertyType: "Villa", postType: "PROPERTY_SALE", price: 5000000, areaSqft: 2000,
  });
});

afterAll(async () => {
  await Offer.deleteMany({ owner: author._id });
  await PropertyPost.deleteMany({ author: author._id });
  await User.deleteOne({ _id: author._id });
  await mongoose.disconnect();
});

const insight = async (id) => {
  const res = fakeRes();
  await getPriceInsight({ params: { id: String(id) }, user: { _id: author._id } }, res);
  return res;
};

describe("getPriceInsight", () => {
  it("flags a listing well below the area median as 'below'", async () => {
    const res = await insight(subjectCheap._id);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.insight.available).toBe(true);
    expect(res.body.data.insight.verdict).toBe("below");
    expect(res.body.data.insight.deltaPct).toBeLessThan(-8);
    expect(res.body.data.insight.medianPricePerSqft).toBeGreaterThan(9000);
  });

  it("flags a listing well above the area median as 'above'", async () => {
    const res = await insight(subjectPricey._id);
    expect(res.body.data.insight.verdict).toBe("above");
    expect(res.body.data.insight.deltaPct).toBeGreaterThan(12);
  });

  it("returns available:false when there aren't enough comparables", async () => {
    const res = await insight(thinCity._id);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.insight.available).toBe(false);
  });

  it("404s for a missing post", async () => {
    const res = await insight(new mongoose.Types.ObjectId());
    expect(res.statusCode).toBe(404);
  });
});

describe("getCardSignals (batch)", () => {
  it("returns price-insight verdict + live offer count per id", async () => {
    const buyer = await User.create({ fullName: "PI Buyer", email: `${tag}-b@t.test`, password: "TestPass1!", isVerified: true });
    await Offer.create({
      post: subjectCheap._id, buyer: buyer._id, owner: author._id,
      listedPrice: subjectCheap.price, currentPrice: 7000000, status: "pending", lastActionBy: buyer._id,
      history: [{ price: 7000000, actorRole: "buyer", by: buyer._id, action: "offer" }],
    });

    const res = { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await getCardSignals(
      { body: { ids: [String(subjectCheap._id), String(subjectPricey._id), String(thinCity._id)] }, user: { _id: author._id } },
      res
    );
    expect(res.statusCode).toBe(200);
    const s = res.body.data.signals;
    expect(s[String(subjectCheap._id)].priceInsight.verdict).toBe("below");
    expect(s[String(subjectCheap._id)].activeOffers).toBe(1);
    expect(s[String(subjectPricey._id)].priceInsight.verdict).toBe("above");
    expect(s[String(subjectPricey._id)].activeOffers).toBe(0);
    expect(s[String(thinCity._id)].priceInsight).toBeNull();

    await User.deleteOne({ _id: buyer._id });
  });

  it("handles an empty id list", async () => {
    const res = { status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
    await getCardSignals({ body: { ids: [] }, user: { _id: author._id } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.signals).toEqual({});
  });
});

describe("getPriceSuggestion (Create Post)", () => {
  const suggest = async (query) => {
    const res = fakeRes();
    await getPriceSuggestion({ query, user: { _id: author._id } }, res);
    return res;
  };

  it("suggests a range from the buy benchmark for the given area", async () => {
    const res = await suggest({ city: benchCity, propertyType: "Apartment", bedrooms: 2, areaSqft: 1000, intent: "buy" });
    expect(res.statusCode).toBe(200);
    const s = res.body.data.suggestion;
    expect(s.available).toBe(true);
    expect(s.mid).toBeGreaterThan(8500000);
    expect(s.mid).toBeLessThan(11500000);
    expect(s.low).toBeLessThan(s.mid);
    expect(s.high).toBeGreaterThan(s.mid);
  });

  it("does not mix rent listings into the buy benchmark", async () => {
    const buy = (await suggest({ city: benchCity, propertyType: "Apartment", bedrooms: 2, areaSqft: 1000, intent: "buy" })).body.data.suggestion;
    expect(buy.medianPricePerSqft).toBeGreaterThan(5000);
  });

  it("returns available:false when info is missing", async () => {
    const res = await suggest({ city: benchCity, propertyType: "Apartment" });
    expect(res.body.data.suggestion.available).toBe(false);
  });
});
