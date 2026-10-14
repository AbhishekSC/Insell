import { describe, it, expect } from "vitest";
import { getListingIntent, extractValidPsf } from "../src/utils/propertyValuationService.js";

describe("propertyValuationService intent and bounds", () => {
  it("correctly identifies rental intent when listingType is rent", () => {
    expect(getListingIntent({ listingType: "Rent", postType: "PROPERTY_SALE", price: 40000 })).toBe("rent");
    expect(getListingIntent({ listingType: "rent", title: "Commercial space" })).toBe("rent");
    expect(getListingIntent({ listingType: "lease" })).toBe("rent");
  });

  it("correctly identifies buy/sale intent when listingType is sell", () => {
    expect(getListingIntent({ listingType: "Sell", postType: "REQUIREMENT_RENT", price: 15000000 })).toBe("buy");
    expect(getListingIntent({ listingType: "buy" })).toBe("buy");
  });

  it("falls back to title keywords if listingType is not explicit", () => {
    expect(getListingIntent({ title: "2 BHK Flat for rent in Ratlam", postType: "PROPERTY_SALE", price: 18000 })).toBe("rent");
    expect(getListingIntent({ title: "Spacious PG accommodation available", price: 8000 })).toBe("rent");
  });

  it("extracts valid PSF within realistic bounds for rent", () => {
    // 3,000 sqft apartment for 40,000 rent => 13.33/sqft
    const psf = extractValidPsf({ price: 40000, areaSqft: 3000 }, "rent");
    expect(psf).toBeCloseTo(13.33, 1);
  });
});
