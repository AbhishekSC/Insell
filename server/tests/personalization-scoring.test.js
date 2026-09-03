// Unit tests for the pure scoring helpers on PersonalizationService — no DB,
// no Redis. Covers the new postType-awareness added alongside the Create Post
// work.
import { describe, it, expect } from "vitest";
import PersonalizationService from "../src/services/PersonalizationService.js";

describe("PersonalizationService.getPostTypeScore", () => {
  it("is neutral (50) when there is no signal yet", () => {
    expect(PersonalizationService.getPostTypeScore({ postType: "PROPERTY_SALE" }, {})).toBe(50);
    expect(
      PersonalizationService.getPostTypeScore({ postType: "PROPERTY_SALE" }, { preferredPostTypes: [] })
    ).toBe(50);
  });

  it("boosts a post type the user engages with", () => {
    const behavior = { preferredPostTypes: [{ type: "AGRICULTURAL_LISTING", score: 40 }] };
    expect(
      PersonalizationService.getPostTypeScore({ postType: "AGRICULTURAL_LISTING" }, behavior)
    ).toBe(90);
  });

  it("caps the boost at 100", () => {
    const behavior = { preferredPostTypes: [{ type: "PROPERTY_RENT", score: 100 }] };
    expect(PersonalizationService.getPostTypeScore({ postType: "PROPERTY_RENT" }, behavior)).toBe(100);
  });

  it("demotes a non-preferred post type", () => {
    const behavior = { preferredPostTypes: [{ type: "PROPERTY_RENT", score: 60 }] };
    expect(
      PersonalizationService.getPostTypeScore({ postType: "COMMERCIAL_LISTING" }, behavior)
    ).toBe(30);
  });
});

describe("PersonalizationService.calculatePropertyScore", () => {
  const user = { friends: [], locationDetails: {} };

  it("stays within 0..100 and runs with an empty behavior blob", () => {
    const score = PersonalizationService.calculatePropertyScore(
      { postType: "PROPERTY_SALE", propertyType: "Apartment", price: 5000000, city: "Indore" },
      user,
      {}
    );
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores a matching post type higher than a non-matching one, all else equal", () => {
    const behavior = {
      preferredPostTypes: [{ type: "AGRICULTURAL_LISTING", score: 80 }],
      preferredPropertyTypes: [],
    };
    const base = { propertyType: "Agricultural Land", price: 2000000, city: "Indore" };
    const match = PersonalizationService.calculatePropertyScore(
      { ...base, postType: "AGRICULTURAL_LISTING" },
      user,
      behavior
    );
    const noMatch = PersonalizationService.calculatePropertyScore(
      { ...base, postType: "PROPERTY_SALE" },
      user,
      behavior
    );
    expect(match).toBeGreaterThan(noMatch);
  });
});
