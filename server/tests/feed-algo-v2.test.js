import { describe, it, expect } from "vitest";
import PersonalizationService from "../src/services/PersonalizationService.js";
import { parseNaturalQuery } from "../src/services/NaturalLanguageSearchService.js";
import { calculateDealProbability } from "../src/services/DealProbabilityService.js";

describe("Feed Algorithm v2 - Unit Test Suite", () => {
  describe("1. Gaussian Budget Scoring", () => {
    const userBehavior = {
      budgetRange: { min: 5000000, max: 7000000 }, // 50L - 70L, midpoint = 60L, sigma = 10L
    };

    it("gives 100 for exact midpoint", () => {
      const score = PersonalizationService.getBudgetScore({ price: 6000000 }, userBehavior);
      expect(score).toBe(100);
    });

    it("smoothly falls off at edges without hard cliffs", () => {
      const scoreInside = PersonalizationService.getBudgetScore({ price: 6500000 }, userBehavior);
      const scoreAtEdge = PersonalizationService.getBudgetScore({ price: 7000000 }, userBehavior);
      const scoreSlightlyAbove = PersonalizationService.getBudgetScore({ price: 7200000 }, userBehavior);
      const scoreFarAbove = PersonalizationService.getBudgetScore({ price: 12000000 }, userBehavior);

      expect(scoreInside).toBeGreaterThan(scoreAtEdge);
      expect(scoreAtEdge).toBeGreaterThan(scoreSlightlyAbove);
      expect(scoreSlightlyAbove).toBeGreaterThan(scoreFarAbove);
      // Properties slightly outside still get decent scores (~50-60) instead of falling off a cliff to 20
      expect(scoreSlightlyAbove).toBeGreaterThan(45);
    });

    it("returns neutral (50) if user has no budget signal", () => {
      expect(PersonalizationService.getBudgetScore({ price: 5000000 }, {})).toBe(50);
    });
  });

  describe("2. AND-of-2 Engagement Matching", () => {
    const userBehavior = {
      engagedProperties: [
        {
          price: 5000000,
          propertyType: "Apartment",
          postType: "PROPERTY_SALE",
          city: "Pune",
          weight: 1.0,
        },
      ],
    };

    it("returns neutral (50) when only 1 dimension matches", () => {
      // Only shares city: "Pune", but price is 10x higher, different type, different postType
      const candidate = {
        price: 50000000,
        propertyType: "Agricultural Land",
        postType: "AGRICULTURAL_LISTING",
        city: "Pune",
      };
      const score = PersonalizationService.getEngagementScore(candidate, userBehavior);
      expect(score).toBe(50);
    });

    it("boosts when at least 2 dimensions match", () => {
      // Matches city AND postType
      const candidate = {
        price: 50000000,
        propertyType: "Villa",
        postType: "PROPERTY_SALE",
        city: "Pune",
      };
      const score = PersonalizationService.getEngagementScore(candidate, userBehavior);
      expect(score).toBeGreaterThan(50);
    });

    it("gives highest boost when all 4 dimensions match", () => {
      const candidate = {
        price: 5200000,
        propertyType: "Apartment",
        postType: "PROPERTY_SALE",
        city: "Pune",
      };
      const score = PersonalizationService.getEngagementScore(candidate, userBehavior);
      expect(score).toBeGreaterThanOrEqual(90);
    });
  });

  describe("3. Listing Quality Multiplier", () => {
    it("computes quality score based on photos, description, and verification", () => {
      const sparseListing = {
        mediaUrls: ["http://img1.jpg"],
        description: "Small flat",
      };
      const highQualityListing = {
        mediaUrls: [
          "http://img1.jpg", "http://img2.jpg", "http://img3.jpg", "http://img4.jpg",
          "http://img5.jpg", "http://img6.jpg", "http://img7.jpg", "http://img8.jpg",
        ],
        description: "Luxurious and spacious 3 BHK apartment in the heart of the city with modern amenities and scenic views.",
        floorPlanUrl: "http://floorplan.jpg",
        videoUrl: "http://tour.mp4",
        author: {
          isOwnerVerified: true,
          responseRate: 95,
          ratingAvg: 4.9,
        },
      };

      const sparseQuality = PersonalizationService.getListingQualityScore(sparseListing, false);
      const highQuality = PersonalizationService.getListingQualityScore(highQualityListing, true);

      expect(highQuality).toBeGreaterThan(sparseQuality);
      expect(highQuality).toBeGreaterThan(80);
      expect(sparseQuality).toBeLessThan(30);
    });
  });

  describe("4. MMR Diversity Re-ranking", () => {
    it("interleaves diverse listings rather than grouping identical ones", () => {
      // 5 identical apartments in Pune, and 2 villas in Mumbai with slightly lower relevance
      const pool = [
        { _id: "1", propertyType: "Apartment", city: "Pune", price: 5000000, finalScore: 95 },
        { _id: "2", propertyType: "Apartment", city: "Pune", price: 5000000, finalScore: 94 },
        { _id: "3", propertyType: "Apartment", city: "Pune", price: 5000000, finalScore: 93 },
        { _id: "4", propertyType: "Apartment", city: "Pune", price: 5000000, finalScore: 92 },
        { _id: "5", propertyType: "Villa", city: "Mumbai", price: 9000000, finalScore: 88 },
        { _id: "6", propertyType: "Plot", city: "Indore", price: 2000000, finalScore: 82 },
      ];

      const reranked = PersonalizationService.mmrRerank(pool, 4, 0.7);
      expect(reranked.length).toBe(4);
      // First is the absolute top score
      expect(reranked[0]._id).toBe("1");
      // Second or third must diversify to Villa/Plot rather than purely repeating Pune apartments
      const types = reranked.map(p => p.propertyType);
      expect(types).toContain("Villa");
    });
  });

  describe("5. Natural Language Property Search Parser", () => {
    it("parses 2BHK near metro with garden in Pune", () => {
      const parsed = parseNaturalQuery("2BHK near metro under 50 lakhs in Pune with garden");
      expect(parsed.bedrooms).toBe(2);
      expect(parsed.propertyType).toBe("Apartment");
      expect(parsed.city).toBe("Pune");
      expect(parsed.maxPrice).toBe(5000000);
      expect(parsed.amenities).toContain("garden");
      expect(parsed.nearTransport).toBe(true);
      expect(parsed.intent).toBe("buy");
    });

    it("parses rental queries with budget in thousands", () => {
      const parsed = parseNaturalQuery("1 RK flat for rent in Thane under 18k with lift");
      expect(parsed.bedrooms).toBe(1);
      expect(parsed.intent).toBe("rent");
      expect(parsed.city).toBe("Thane");
      expect(parsed.maxPrice).toBe(18000);
      expect(parsed.amenities).toContain("lift");
    });

    it("parses price range with crore and lakh denominations", () => {
      const parsed = parseNaturalQuery("3 BHK in Bangalore between 1.5 cr and 2.2 cr with swimming pool");
      expect(parsed.bedrooms).toBe(3);
      expect(parsed.city).toBe("Bangalore");
      expect(parsed.minPrice).toBe(15000000);
      expect(parsed.maxPrice).toBe(22000000);
      expect(parsed.amenities).toContain("swimming pool");
    });
  });

  describe("6. Deal Probability Scoring", () => {
    it("predicts high deal probability for competitive pricing & verified responsive seller", () => {
      const property = {
        price: 6000000,
        areaSqft: 1000, // 6000 psf vs 7000 median (-14%)
        createdAt: new Date(Date.now() - 25 * 24 * 3600 * 1000),
        likedBy: ["1", "2", "3"],
        savedBy: ["4", "5", "6", "7"],
        viewsCount: 150,
        isAddressVerified: true,
      };
      const author = {
        responseRate: 95,
        ratingAvg: 4.9,
        isOwnerVerified: true,
      };
      const benchmark = { medianPricePerSqft: 7000 };

      const result = calculateDealProbability(property, author, benchmark);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.level).toBe("HIGH");
      expect(result.factors.responseScore).toBe(95);
      expect(result.factors.verificationScore).toBe(100);
    });
  });
});
