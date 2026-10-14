import { describe, it, expect } from "vitest";
import { extractRatesFromSnippets } from "../src/services/marketPriceScraper.service.js";

describe("Market Price Scraper & Regex Parser", () => {
  it("extracts rent-per-sqft rates from 99acres and magicbricks snippets", () => {
    const mockOrganic = [
      {
        title: "1BHK Residential House for Rent in 80ft road Ratlam",
        snippet: "Updated 5 days ago. ₹7,000. 1 BHK House for Rent in 80ft road Ratlam. Furnishing. Unfurnished. Super Area. 450 sqft.",
        link: "https://www.magicbricks.com/property-for-rent",
      },
      {
        title: "Commercial Property for Rent/Lease in Ratlam",
        snippet: "Approx. 1,800 sq ft per floor rent: Rs. 27,000/month",
        link: "https://www.99acres.com/commercial-rent",
      },
      {
        title: "Flats for Rent near MIdtown Township, Ratlam",
        snippet: "The monthly rent is ₹19,000. 1000 sqft A residential house is available for rent.",
        link: "https://housing.com/rent",
      },
    ];

    const parsed = extractRatesFromSnippets(mockOrganic, "rent");
    expect(parsed.rates.length).toBeGreaterThan(0);
    // 7000 / 450 = 15.6, 27000 / 1800 = 15, 19000 / 1000 = 19
    expect(parsed.rates).toContain(15.6);
    expect(parsed.rates).toContain(15);
    expect(parsed.rates).toContain(19);
    expect(parsed.sources).toContain("Magicbricks");
    expect(parsed.sources).toContain("99acres");
    expect(parsed.sources).toContain("Housing.com");
  });

  it("extracts sale/buy price-per-sqft rates accurately", () => {
    const mockOrganic = [
      {
        title: "Property in Kasturba Nagar Ratlam",
        snippet: "Residential property · ₹80 Lac. ₹9,142 /sqft ; 4 Bedroom House · ₹75 Lac. ₹6,250 /sqft",
        link: "https://www.99acres.com/property-in-kasturba-nagar",
      },
      {
        title: "Property Rates in Ratlam - 2026",
        snippet: "Starting price is Rs. 2,500 per sqft and average price of properties is Rs. 5,614 per sqft.",
        link: "https://housing.com/price-trends",
      },
    ];

    const parsed = extractRatesFromSnippets(mockOrganic, "buy");
    expect(parsed.rates).toContain(9142);
    expect(parsed.rates).toContain(6250);
    expect(parsed.rates).toContain(2500);
    expect(parsed.rates).toContain(5614);
    expect(parsed.sources).toContain("99acres");
    expect(parsed.sources).toContain("Housing.com");
  });

  it("filters out absurd outliers outside sanity bounds", () => {
    const mockOrganic = [
      {
        title: "Tiny stall",
        snippet: "Rent ₹10,000,000 per month 10 sqft. Or ₹1 /sqft",
        link: "https://test.com",
      },
    ];

    const parsed = extractRatesFromSnippets(mockOrganic, "rent");
    // Rates should be bounded between 4 and 250
    expect(parsed.rates).not.toContain(1);
    expect(parsed.rates).not.toContain(1000000);
  });
});
