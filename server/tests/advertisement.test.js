import { describe, it, expect } from "vitest";
import { calculateAdScore, balanceAdFeed } from "../src/controllers/advertisement.controller.js";
import { AD_CATEGORIES } from "../src/models/Advertisement.model.js";

describe("Advertisement Targeting & Metrics Logic", () => {
  const sampleAds = [
    {
      _id: "ad1",
      title: "Luxury Flats in Mumbai",
      description: "Sea facing apartments in Bandra",
      status: "active",
      targetCity: "Mumbai",
      targetIntent: "Buy",
      startDate: new Date(Date.now() - 3600000),
      endDate: null,
      impressionsCount: 100,
      clicksCount: 5,
    },
    {
      _id: "ad2",
      title: "Co-living spaces in Bangalore",
      description: "Furnished rooms in Indiranagar",
      status: "active",
      targetCity: "Bangalore",
      targetIntent: "Rent",
      startDate: new Date(Date.now() - 3600000),
      endDate: null,
      impressionsCount: 200,
      clicksCount: 20,
    },
    {
      _id: "ad3",
      title: "Pan-India Home Loans",
      description: "Lowest interest rate 8.2%",
      status: "active",
      targetCity: "", // All cities
      targetIntent: "All",
      startDate: new Date(Date.now() - 3600000),
      endDate: null,
      impressionsCount: 50,
      clicksCount: 1,
    },
    {
      _id: "ad4",
      title: "Expired Promo",
      description: "Old campaign",
      status: "paused",
      targetCity: "",
      targetIntent: "All",
      startDate: new Date(Date.now() - 7200000),
      endDate: new Date(Date.now() - 3600000),
      impressionsCount: 10,
      clicksCount: 0,
    },
  ];

  it("filters ads by status and active date range", () => {
    const now = new Date();
    const activeAds = sampleAds.filter(
      (ad) =>
        ad.status === "active" &&
        ad.startDate <= now &&
        (!ad.endDate || ad.endDate >= now)
    );
    expect(activeAds.map((a) => a._id)).toEqual(["ad1", "ad2", "ad3"]);
  });

  it("targets ads by city accurately (city-specific + pan-India)", () => {
    const userCity = "Mumbai";
    const matching = sampleAds
      .filter((ad) => ad.status === "active")
      .filter(
        (ad) =>
          !ad.targetCity ||
          ad.targetCity.toLowerCase() === userCity.toLowerCase()
      );
    expect(matching.map((a) => a._id)).toEqual(["ad1", "ad3"]);
  });

  it("targets ads by intent (Buy vs Rent vs All)", () => {
    const intent = "Rent";
    const matching = sampleAds
      .filter((ad) => ad.status === "active")
      .filter(
        (ad) =>
          ad.targetIntent === "All" ||
          ad.targetIntent.toLowerCase() === intent.toLowerCase()
      );
    expect(matching.map((a) => a._id)).toEqual(["ad2", "ad3"]);
  });

  it("computes CTR (Click-Through Rate) percentage correctly", () => {
    const calculateCtr = (clicks, impressions) => {
      if (!impressions || impressions <= 0) return 0;
      return Number(((clicks / impressions) * 100).toFixed(2));
    };

    expect(calculateCtr(5, 100)).toBe(5);
    expect(calculateCtr(20, 200)).toBe(10);
    expect(calculateCtr(1, 50)).toBe(2);
    expect(calculateCtr(0, 0)).toBe(0);
  });

  it("filters out ads exceeding the user daily frequency cap", () => {
    const userImpressionsToday = {
      ad1: 3, // reached cap
      ad2: 1, // under cap
      ad3: 0, // never seen
    };
    const adsWithCaps = [
      { _id: "ad1", frequencyCap: 3 },
      { _id: "ad2", frequencyCap: 3 },
      { _id: "ad3", frequencyCap: 2 },
    ];

    const eligible = adsWithCaps.filter((ad) => {
      const views = userImpressionsToday[ad._id] || 0;
      return views < ad.frequencyCap;
    });

    expect(eligible.map((a) => a._id)).toEqual(["ad2", "ad3"]);
  });

  it("permanently excludes ads hidden by the user", () => {
    const userHiddenAds = ["ad1"];
    const activeAds = [{ _id: "ad1" }, { _id: "ad2" }, { _id: "ad3" }];

    const filtered = activeAds.filter((ad) => !userHiddenAds.includes(ad._id));
    expect(filtered.map((a) => a._id)).toEqual(["ad2", "ad3"]);
  });

  it("calculates coin valuation and pricing plans correctly", () => {
    // 4 coins = 0.4 INR -> 1 coin = 0.10 INR
    const coinValueInRupees = (coins) => coins * 0.1;
    expect(coinValueInRupees(4)).toBeCloseTo(0.4);
    expect(coinValueInRupees(65)).toBeCloseTo(6.5);
    expect(coinValueInRupees(200)).toBe(20);
    expect(coinValueInRupees(500)).toBe(50);
    expect(coinValueInRupees(1000)).toBe(100);
  });

  it("calculates ad relevance score, CTR quality multiplier, and anti-fatigue penalty", () => {
    const realEstateAd = {
      _id: "re1",
      adCategory: "Real Estate",
      targetCity: "Mumbai",
      impressionsCount: 100,
      clicksCount: 4, // 4% CTR
    };

    const lifestyleAd = {
      _id: "ls1",
      adCategory: "Lifestyle & Entertainment",
      targetCity: "", // All cities
      impressionsCount: 100,
      clicksCount: 1, // 1% CTR
    };

    // Unseen Real Estate ad in Mumbai for a Mumbai user:
    // Relevance = 1.5 + 0.4 = 1.9. Quality = min(2.5, max(0.5, (4 + 0.5)/2)) = 2.25. Fatigue = 0.
    // Score = 1.9 * 2.25 = 4.275
    const score1 = calculateAdScore({ ad: realEstateAd, userCity: "Mumbai", viewsToday: 0 });
    expect(score1).toBe(4.275);

    // If user has already seen it twice today:
    // Fatigue = 2 * 0.4 = 0.8. Score = 4.275 - 0.8 = 3.475
    const scoreSeenTwice = calculateAdScore({ ad: realEstateAd, userCity: "Mumbai", viewsToday: 2 });
    expect(scoreSeenTwice).toBe(3.475);

    // Lifestyle ad for Mumbai user (no city bonus):
    // Relevance = 0.9. Quality = (1 + 0.5)/2 = 0.75. Score = 0.9 * 0.75 = 0.675
    const scoreLifestyle = calculateAdScore({ ad: lifestyleAd, userCity: "Mumbai", viewsToday: 0 });
    expect(scoreLifestyle).toBe(0.675);

    expect(score1).toBeGreaterThan(scoreLifestyle);
  });

  it("balances feed so core property/services ads outnumber lifestyle ads (2:1 ratio)", () => {
    const scoredList = [
      { ad: { _id: "c1", adCategory: "Real Estate" }, score: 4.5 },
      { ad: { _id: "c2", adCategory: "Home Loans & Finance" }, score: 3.8 },
      { ad: { _id: "c3", adCategory: "Interiors & Services" }, score: 3.2 },
      { ad: { _id: "l1", adCategory: "Lifestyle & Entertainment" }, score: 5.0 }, // high lifestyle score shouldn't monopolize
      { ad: { _id: "l2", adCategory: "Lifestyle & Entertainment" }, score: 4.8 },
      { ad: { _id: "c4", adCategory: "Real Estate" }, score: 2.9 },
    ];

    const balanced = balanceAdFeed(scoredList, 6);
    const categories = balanced.map((a) => a.adCategory);

    // Should lead with up to 2 core ads (c1, c2), then 1 lifestyle ad (l1), then core (c3, c4), then lifestyle (l2)
    expect(categories[0]).not.toBe("Lifestyle & Entertainment");
    expect(categories[1]).not.toBe("Lifestyle & Entertainment");
    expect(categories[2]).toBe("Lifestyle & Entertainment");
    expect(categories[3]).not.toBe("Lifestyle & Entertainment");
    expect(balanced.map((a) => a._id)).toEqual(["c1", "c2", "l1", "c3", "c4", "l2"]);
  });

  it("verifies AD_CATEGORIES contains the 4 standard industry categories", () => {
    expect(AD_CATEGORIES).toEqual([
      "Real Estate",
      "Home Loans & Finance",
      "Interiors & Services",
      "Lifestyle & Entertainment",
    ]);
  });
});

