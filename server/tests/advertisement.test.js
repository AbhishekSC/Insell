import { describe, it, expect } from "vitest";

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
});
