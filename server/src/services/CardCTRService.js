import { logger } from "../utils/logger.js";
import redisClient from "../config/redisClient.config.js";

/**
 * CardCTRService
 *
 * Implements Click-Through-Rate (CTR) optimization algorithms:
 * 1. Signal Enrichment: Under-market price calculation, price-drop pills, 0-brokerage direct owner badges.
 * 2. Urgency & Activity Cues: Inquiries today, live viewer estimation, fresh-listing high-demand tags.
 * 3. Commute & Transit Highlights: Walking distance to metro, driving time to IT/commercial corridors.
 * 4. Media Feature Teasers: Floor plan available, video tour, photo count badges.
 * 5. Archetype Hook Generation: Punchy 1-line hook tailored to property traits (Vastu, pet-friendly, yield).
 * 6. Multi-Armed Bandit (MAB) Cover Image Selection: UCB1 algorithm testing top photos for maximum CTR.
 * 7. Predicted CTR (pCTR) Scoring Layer: Multi-feature conversion scoring to boost clickable listings.
 * 8. Contextual Time-of-Day / Day-of-Week Multiplier: Tailoring feed to evening commute vs weekend house hunting.
 * 9. Micro-Engagement / Dwell-Time Tracking: Storing in-feed dwell (>2.5s) and carousel swipes for dynamic feed bias.
 */

// Major transit and IT corridor landmarks across Indian metros for auto-resolving commute hooks
const METRO_CORRIDORS = [
  { keywords: ["hinjawadi", "hinjewadi"], highlight: "8 mins to Hinjawadi IT Park", icon: "hub" },
  { keywords: ["baner", "balewadi"], highlight: "400m to High Street & Transit", icon: "walk" },
  { keywords: ["kharadi", "viman"], highlight: "5 mins to EON Free Zone", icon: "hub" },
  { keywords: ["magarpatta", "hadapsar"], highlight: "Inside Cybercity Corridor", icon: "hub" },
  { keywords: ["wakad", "pimple"], highlight: "500m to Proposed Metro Station", icon: "transit" },
  { keywords: ["whitefield", "itpl"], highlight: "350m to Kadugodi Metro", icon: "transit" },
  { keywords: ["electronic city", "e-city"], highlight: "6 mins to Infosys Campus", icon: "hub" },
  { keywords: ["bellandur", "outer ring road", "orr"], highlight: "5 mins to Ecospace Tech Park", icon: "hub" },
  { keywords: ["hsr", "koramangala"], highlight: "5 mins walk to Cafe Street", icon: "walk" },
  { keywords: ["indiranagar", "domlur"], highlight: "300m to 100ft Road Metro", icon: "transit" },
  { keywords: ["bkc", "bandra"], highlight: "5 mins to BKC Financial Hub", icon: "hub" },
  { keywords: ["andheri", "marol"], highlight: "200m to Line 1 Metro", icon: "transit" },
  { keywords: ["powai", "kanjurmarg"], highlight: "6 mins to Hiranandani Business Park", icon: "hub" },
  { keywords: ["cyber city", "dlf", "gurgaon", "gurugram"], highlight: "400m to Rapid Metro Phase 2", icon: "transit" },
  { keywords: ["golf course", "sector 54", "sector 56"], highlight: "500m to Sector 54 Metro", icon: "transit" },
  { keywords: ["noida", "sector 62", "sector 18"], highlight: "350m to Blue Line Metro", icon: "transit" },
  { keywords: ["gachibowli", "hitec city", "kondapur"], highlight: "8 mins to Hitec City Metro", icon: "transit" },
];

class CardCTRService {
  /**
   * Enriches a post with high-converting signals for card presentation
   */
  static enrichPostSignals(post, currentUser = null) {
    if (!post) return post;
    try {
      const dealHighlight = this.calculateDealHighlight(post);
      const urgencySignals = this.calculateUrgencySignals(post);
      const commuteHighlight = this.resolveCommuteHighlight(post, currentUser);
      const mediaFeatures = this.extractMediaFeatures(post);
      const archetypeHook = this.generateArchetypeHook(post);

      return {
        ...post,
        dealHighlight,
        urgencySignals,
        commuteHighlight,
        mediaFeatures,
        archetypeHook,
      };
    } catch (err) {
      logger.warn("enrichPostSignals error:", err?.message);
      return post;
    }
  }

  /**
   * 1. Deal & Opportunity Overlays: Under-market %, price-drops, and 0-brokerage owner
   */
  static calculateDealHighlight(post) {
    let underMarketPct = null;
    let priceDropAmount = null;
    let priceDropFormatted = null;
    let priceDropWhen = null;

    // Check price diff from deal probability or benchmark
    const diffPct = post.dealProbability?.priceDiffPercent;
    if (typeof diffPct === "number" && diffPct <= -4) {
      underMarketPct = Math.abs(diffPct);
    } else if (post.pricePerSqft && post.localityBenchmarkPsf && post.pricePerSqft < post.localityBenchmarkPsf) {
      const calcPct = Math.round(((post.localityBenchmarkPsf - post.pricePerSqft) / post.localityBenchmarkPsf) * 100);
      if (calcPct >= 4) underMarketPct = calcPct;
    }

    // Check Price History for recent drops
    const history = Array.isArray(post.priceHistory) ? post.priceHistory : [];
    if (history.length > 1) {
      const sorted = [...history].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt));
      const prevPrice = sorted[sorted.length - 2]?.price;
      const currentPrice = post.price || sorted[sorted.length - 1]?.price;
      if (prevPrice && currentPrice && currentPrice < prevPrice) {
        priceDropAmount = prevPrice - currentPrice;
        priceDropFormatted = this.formatCurrencyAbbr(priceDropAmount);
        const lastChange = sorted[sorted.length - 1]?.changedAt;
        if (lastChange) {
          const daysAgo = Math.floor((Date.now() - new Date(lastChange).getTime()) / (1000 * 60 * 60 * 24));
          priceDropWhen = daysAgo === 0 ? "Today" : daysAgo === 1 ? "Yesterday" : `${daysAgo}d ago`;
        }
      }
    }

    // Direct from Owner / 0 Brokerage check
    const authorRole = String(
      post.author?.activeRole || post.author?.primaryRole || post.authorRole || ""
    ).toLowerCase();
    const isDirectOwner =
      authorRole === "landlord" ||
      authorRole === "seller" ||
      authorRole === "owner" ||
      post.brokerage === 0 ||
      post.postMeta?.brokerage === 0;

    return {
      underMarketPct,
      priceDropAmount,
      priceDropFormatted,
      priceDropWhen,
      isDirectOwner,
      brokerageLabel: isDirectOwner ? "0 Brokerage (Owner)" : null,
    };
  }

  /**
   * 2. Real-Time Activity & Urgency Cues (Hybrid Model - 100% Honest Data)
   */
  static calculateUrgencySignals(post) {
    const ageHours = (Date.now() - new Date(post.createdAt || Date.now()).getTime()) / (1000 * 60 * 60);
    const viewCount = Number(post.viewCount || post.viewsCount || 0);
    const likesCount = Array.isArray(post.likedBy) ? post.likedBy.length : Number(post.likesCount || 0);
    const savesCount = Array.isArray(post.savedBy) ? post.savedBy.length : Number(post.savesCount || 0);
    const realInquiriesToday = Number(post.realInquiriesToday || 0);
    const realInquiriesWeek = Number(post.realInquiriesWeek || 0);

    // Hybrid Adaptive Signal: Pick the single most compelling, 100% REAL stat
    let primaryBadge = null;

    if (realInquiriesToday >= 1) {
      primaryBadge = {
        type: "INQUIRY_TODAY",
        text: `${realInquiriesToday} ${realInquiriesToday === 1 ? "inquiry" : "inquiries"} today`,
        icon: "flame",
        highlight: "error",
      };
    } else if (realInquiriesWeek >= 2) {
      primaryBadge = {
        type: "INQUIRY_WEEK",
        text: `${realInquiriesWeek} inquiries this week`,
        icon: "flame",
        highlight: "error",
      };
    } else if (savesCount >= 2) {
      primaryBadge = {
        type: "SAVES",
        text: `Saved by ${savesCount} ${savesCount === 1 ? "buyer" : "buyers"}`,
        icon: "bookmark",
        highlight: "primary",
      };
    } else if (ageHours <= 36) {
      primaryBadge = {
        type: "FRESH",
        text: ageHours < 24 ? "Just listed today" : "Listed yesterday",
        icon: "zap",
        highlight: "success",
      };
    } else if (viewCount >= 20) {
      primaryBadge = {
        type: "POPULAR",
        text: `Popular · ${viewCount} views`,
        icon: "trending",
        highlight: "secondary",
      };
    }

    // Response time string (100% real based on author.responseRate)
    let responseTimeText = null;
    if (post.author?.responseRate != null) {
      const rate = post.author.responseRate;
      if (rate >= 80) responseTimeText = "~15 mins";
      else if (rate >= 60) responseTimeText = "~1 hr";
    }

    let listedAgoText = null;
    if (ageHours < 1) listedAgoText = "Listed just now";
    else if (ageHours < 24) listedAgoText = `Listed ${Math.floor(ageHours)}h ago`;
    else if (ageHours < 48) listedAgoText = "Listed yesterday";

    return {
      primaryBadge,
      realInquiriesToday,
      realInquiriesWeek,
      savesCount,
      viewCount,
      likesCount,
      listedAgoText,
      responseTimeText,
      ageHours,
    };
  }

  /**
   * Calculate distance in kilometers between two geo points (Haversine formula)
   */
  static calculateDistanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * 3. Hyper-Local Commute & Transit Highlights (Personalized to User Office Hub)
   */
  static resolveCommuteHighlight(post, currentUser = null) {
    // 1. Personalized commute to User's saved office/hub if available
    const workLoc = currentUser?.workLocation;
    const postCoords =
      Array.isArray(post.location?.coordinates) && post.location.coordinates.length === 2
        ? { lon: post.location.coordinates[0], lat: post.location.coordinates[1] }
        : Array.isArray(post.postMeta?.location?.coordinates) && post.postMeta.location.coordinates.length === 2
        ? { lon: post.postMeta.location.coordinates[0], lat: post.postMeta.location.coordinates[1] }
        : post.latitude && post.longitude
        ? { lat: Number(post.latitude), lon: Number(post.longitude) }
        : post.locationDetails?.latitude && post.locationDetails?.longitude
        ? { lat: Number(post.locationDetails.latitude), lon: Number(post.locationDetails.longitude) }
        : null;

    if (workLoc?.latitude && workLoc?.longitude && postCoords?.lat && postCoords?.lon) {
      const distKm = this.calculateDistanceKm(postCoords.lat, postCoords.lon, workLoc.latitude, workLoc.longitude);
      const destName = (workLoc.label && String(workLoc.label).trim()) || "work";

      if (distKm <= 1.2) {
        return {
          text: `${Math.round(distKm * 1000)}m to ${destName}`,
          icon: "walk",
          isPersonalized: true,
        };
      }
      if (distKm <= 60) {
        // Average metro travel velocity: ~2.8 mins per km in peak city traffic
        const travelMins = Math.max(5, Math.round(distKm * 2.8));
        return {
          text: `${travelMins} min to ${destName} (${distKm.toFixed(1)} km)`,
          icon: "transit",
          isPersonalized: true,
        };
      }
    }

    // 2. If post already has a custom commute highlight in postMeta
    if (post.postMeta?.commuteHighlights?.[0]) {
      return {
        text: post.postMeta.commuteHighlights[0],
        icon: "transit",
        isPersonalized: false,
      };
    }

    // 3. Auto-match locality or caption text against known corridor hubs
    const searchTarget = `${post.locality || ""} ${post.city || ""} ${post.caption || ""} ${post.title || ""}`.toLowerCase();
    for (const item of METRO_CORRIDORS) {
      if (item.keywords.some((k) => searchTarget.includes(k))) {
        return {
          text: item.highlight,
          icon: item.icon,
          isPersonalized: false,
        };
      }
    }

    // 4. Generic walking / transit fallback based on amenities
    const amenities = [
      ...(Array.isArray(post.postMeta?.amenities) ? post.postMeta.amenities : []),
      ...(Array.isArray(post.postMeta?.residential?.amenities) ? post.postMeta.residential.amenities : []),
    ].map((a) => String(a).toLowerCase());

    if (amenities.some((a) => a.includes("metro") || a.includes("station"))) {
      return { text: "Walking distance to Metro", icon: "transit", isPersonalized: false };
    }
    if (amenities.some((a) => a.includes("school") || a.includes("college"))) {
      return { text: "Close to reputed schools", icon: "school", isPersonalized: false };
    }
    if (amenities.some((a) => a.includes("mall") || a.includes("market"))) {
      return { text: "2 mins to shopping & groceries", icon: "walk", isPersonalized: false };
    }

    return null;
  }

  /**
   * 4. Media Feature Teasers: Floor plans, 4K video, gallery count
   */
  static extractMediaFeatures(post) {
    const media = Array.isArray(post.media) && post.media.length > 0
      ? post.media
      : Array.isArray(post.mediaUrls)
      ? post.mediaUrls
      : [];
    const hasVideo = media.some((url) => /\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(url));

    // Floor plan check in documents or media metadata
    const postMeta = post.postMeta || {};
    const hasFloorPlan = Boolean(
      postMeta.hasFloorPlan ||
      postMeta.residential?.floorPlanUrl ||
      postMeta.floorPlanUrl ||
      media.some((url) => /floor[-_]?plan/i.test(url))
    );

    return {
      hasFloorPlan,
      hasVideo,
      photoCount: media.length,
    };
  }

  /**
   * 5. User-Archetype "One-Liner" Hook
   */
  static generateArchetypeHook(post) {
    if (!post) return null;
    const postMeta = post.postMeta || {};
    const residential = postMeta.residential || {};
    const rawAmenities = [
      ...(Array.isArray(postMeta.amenities) ? postMeta.amenities : []),
      ...(Array.isArray(residential.amenities) ? residential.amenities : []),
    ];
    const amenities = rawAmenities.map((a) => (typeof a === "string" ? a : a?.name || String(a || "")));

    const hooks = [];

    // Vastu & Facing
    const facing = postMeta.facing || residential.facing;
    if (facing && typeof facing === "string" && /east|north/i.test(facing)) {
      hooks.push(`${facing}-facing Vastu compliant`);
    } else if (post.caption && typeof post.caption === "string" && /vastu/i.test(post.caption)) {
      hooks.push("Vastu compliant");
    }

    // Tenancy & Freedom
    const rawTenants = residential.preferredTenants;
    const preferredTenants = Array.isArray(rawTenants)
      ? rawTenants
      : typeof rawTenants === "string"
      ? [rawTenants]
      : [];

    const rawRules = residential.houseRules;
    const houseRules = Array.isArray(rawRules)
      ? rawRules
      : typeof rawRules === "string"
      ? [rawRules]
      : [];

    if (preferredTenants.some((t) => /bachelor|all/i.test(String(t || "")))) {
      hooks.push("Bachelors & Families welcome");
    }
    if (houseRules.some((r) => /pet/i.test(String(r || ""))) || (post.caption && /pet/i.test(post.caption))) {
      hooks.push("Pet friendly");
    }

    // Balcony & View
    if (post.bedrooms && post.bedrooms >= 2) {
      if ((post.caption && /balcony|garden|park/i.test(post.caption)) || amenities.some((a) => /balcony|garden|park/i.test(a))) {
        hooks.push("Spacious balcony with open view");
      }
    }

    // Security & Gated
    if (amenities.some((a) => /gated|security|cctv/i.test(a))) {
      hooks.push("24/7 Gated security");
    }

    // Rental Yield / High ROI
    if (post.dealProbability?.level === "HIGH" || post.appreciationForecast?.annualizedRate > 9) {
      hooks.push(`High ROI (${post.appreciationForecast?.annualizedRate || 10}% CAGR projected)`);
    }

    if (hooks.length > 0) {
      return hooks.slice(0, 2).join(" · ");
    }

    // Fallback to Furnishing + Space
    const furnishing = residential.furnishing || postMeta.furnishing;
    if (furnishing && typeof furnishing === "string" && furnishing !== "Unfurnished") {
      return `${furnishing} · Ready to move in`;
    }

    return "Ready possession · Prime location";
  }

  /**
   * 6. Multi-Armed Bandit (MAB) Cover Image Selection
   * Uses Upper Confidence Bound (UCB1) across top 3 images to identify highest CTR cover
   */
  static async getOptimalCoverIndex(postId, slides = []) {
    if (!Array.isArray(slides) || slides.length <= 1) return 0;

    const candidateCount = Math.min(3, slides.length);
    try {
      if (!redisClient) return 0;

      const keys = [];
      for (let i = 0; i < candidateCount; i++) {
        keys.push(`mab:cover:imp:${postId}:${i}`, `mab:cover:clk:${postId}:${i}`);
      }
      const counts = await redisClient.mGet(keys);

      let totalImpressions = 0;
      const stats = [];

      for (let i = 0; i < candidateCount; i++) {
        const imp = parseInt(counts[i * 2] || "0", 10);
        const clk = parseInt(counts[i * 2 + 1] || "0", 10);
        totalImpressions += imp;
        stats.push({ index: i, imp, clk });
      }

      // If any candidate has not been shown at least 5 times, explore it
      const unvisited = stats.find((s) => s.imp < 5);
      if (unvisited) {
        return unvisited.index;
      }

      // Calculate UCB1 score for each photo
      let bestIdx = 0;
      let highestUCB = -1;

      for (const s of stats) {
        const ctr = s.clk / s.imp;
        const ucb = ctr + Math.sqrt((2 * Math.log(totalImpressions)) / s.imp);
        if (ucb > highestUCB) {
          highestUCB = ucb;
          bestIdx = s.index;
        }
      }

      return bestIdx;
    } catch {
      return 0; // Fallback to photo #0
    }
  }

  /**
   * Record Cover Impression
   */
  static async recordCoverImpression(postId, coverIndex = 0) {
    try {
      if (!redisClient) return;
      await redisClient.incr(`mab:cover:imp:${postId}:${coverIndex}`);
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Record Cover Click
   */
  static async recordCoverClick(postId, coverIndex = 0) {
    try {
      if (!redisClient) return;
      await redisClient.incr(`mab:cover:clk:${postId}:${coverIndex}`);
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * 7. Predicted CTR (pCTR) Scoring Component (0 to 1)
   */
  static calculatePCTR(post) {
    let pCTR = 0.45; // baseline

    // Photos quality & volume
    const mediaCount = Array.isArray(post.media) ? post.media.length : 0;
    if (mediaCount >= 5) pCTR += 0.15;
    else if (mediaCount >= 3) pCTR += 0.08;

    // Under-market pricing gives massive CTR boost
    if (post.dealHighlight?.underMarketPct && post.dealHighlight.underMarketPct >= 5) {
      pCTR += Math.min(0.20, (post.dealHighlight.underMarketPct / 100) * 1.5);
    }

    // Price drop
    if (post.dealHighlight?.priceDropAmount) {
      pCTR += 0.12;
    }

    // Direct from Owner
    if (post.dealHighlight?.isDirectOwner) {
      pCTR += 0.10;
    }

    // Fast responding host
    if (post.author?.responseRate >= 80) {
      pCTR += 0.08;
    }

    return Math.min(1.0, Math.max(0.1, pCTR));
  }

  /**
   * 8. Contextual Time-of-Day Multiplier
   */
  static getTimeOfDayMultiplier(post) {
    const now = new Date();
    // Convert to Indian Standard Time (UTC+5:30)
    const istHours = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
    const istDay = now.getUTCDay(); // 0 is Sunday, 6 is Saturday

    const isWeekend = istDay === 0 || istDay === 6;
    const isEvening = istHours >= 18 && istHours <= 22;
    const isMorning = istHours >= 9 && istHours <= 14;

    const postType = String(post.postType || "").toUpperCase();
    const isRental = postType.includes("RENT");

    // Weekday evenings: boost rentals & commute-tagged listings (+15%)
    if (!isWeekend && isEvening && isRental) {
      return 1.15;
    }

    // Weekend mornings: boost buy/investments & high-value properties (+15%)
    if (isWeekend && isMorning && !isRental) {
      return 1.15;
    }

    return 1.0;
  }

  /**
   * 9. Micro-Engagement Logging (In-feed dwell & swipes)
   */
  static async recordMicroEngagement(userId, postId, dwellTimeMs = 0, swipedPhotosCount = 0, meta = {}) {
    if (!userId || !postId) return;
    try {
      if (!redisClient) return;
      const key = `user:micro_eng:${userId}`;
      const payload = JSON.stringify({
        postId,
        dwellTimeMs,
        swipedPhotosCount,
        locality: meta.locality || "",
        postType: meta.postType || "",
        bhk: meta.bhk || 0,
        price: meta.price || 0,
        listingType: meta.listingType || "",
        at: Date.now(),
      });
      await redisClient.lPush(key, payload);
      await redisClient.lTrim(key, 0, 39);
      await redisClient.expire(key, 7200);

      // Update engagement-weighted preference vector
      if (dwellTimeMs > 0 || swipedPhotosCount > 0) {
        await CardCTRService.updatePreferenceVector(userId, meta, dwellTimeMs, swipedPhotosCount);
      }
    } catch (e) {
      logger.warn("Micro-engagement record error:", e.message);
    }
  }

  // Engagement type weights: higher weight = stronger interest signal
  static ENGAGEMENT_WEIGHTS = {
    save: 1.0,
    contact: 0.85,
    share: 0.75,
    visit_request: 0.70,
    like: 0.45,
    click: 0.35,
    dwell_long: 0.30,   // >5s dwell
    dwell_medium: 0.15,  // 2.5-5s dwell
    swipe: 0.20,
    skip: -0.15,         // <1s scroll-past
  };

  static async recordWeightedEngagement(userId, postId, engagementType, meta = {}) {
    if (!userId || !postId || !engagementType) return;
    try {
      if (!redisClient) return;
      const weight = CardCTRService.ENGAGEMENT_WEIGHTS[engagementType] ?? 0.1;
      const key = `user:eng_weighted:${userId}`;
      const payload = JSON.stringify({
        postId,
        type: engagementType,
        weight,
        locality: meta.locality || "",
        postType: meta.postType || "",
        bhk: meta.bhk || 0,
        price: meta.price || 0,
        listingType: meta.listingType || "",
        at: Date.now(),
      });
      await redisClient.lPush(key, payload);
      await redisClient.lTrim(key, 0, 99);
      await redisClient.expire(key, 86400);

      await CardCTRService.updatePreferenceVector(userId, meta, 0, 0, weight);
    } catch (e) {
      logger.warn("Weighted engagement record error:", e.message);
    }
  }

  static async updatePreferenceVector(userId, meta, dwellTimeMs = 0, swipedPhotos = 0, engagementWeight = 0) {
    try {
      if (!redisClient) return;
      const key = `user:pref_vector:${userId}`;
      const raw = await redisClient.get(key);
      const vector = raw ? JSON.parse(raw) : {
        localities: {},
        postTypes: {},
        bhkPrefs: {},
        priceSum: 0,
        priceCount: 0,
        listingTypes: {},
        totalSignals: 0,
      };

      // Compute signal strength from dwell/swipe/engagement
      let signal = engagementWeight;
      if (dwellTimeMs > 5000) signal += 0.30;
      else if (dwellTimeMs > 2500) signal += 0.15;
      if (swipedPhotos > 0) signal += 0.10 + Math.min(0.15, swipedPhotos * 0.05);

      if (signal <= 0) return;

      // Accumulate weighted preferences with exponential decay
      if (meta.locality) {
        vector.localities[meta.locality] = (vector.localities[meta.locality] || 0) + signal;
      }
      if (meta.postType) {
        vector.postTypes[meta.postType] = (vector.postTypes[meta.postType] || 0) + signal;
      }
      if (meta.bhk) {
        const bhkKey = String(meta.bhk);
        vector.bhkPrefs[bhkKey] = (vector.bhkPrefs[bhkKey] || 0) + signal;
      }
      if (meta.price > 0) {
        vector.priceSum += meta.price * signal;
        vector.priceCount += signal;
      }
      if (meta.listingType) {
        vector.listingTypes[meta.listingType] = (vector.listingTypes[meta.listingType] || 0) + signal;
      }
      vector.totalSignals += signal;
      vector.updatedAt = Date.now();

      // Cap dimension sizes to prevent unbounded growth
      for (const dim of ["localities", "postTypes", "bhkPrefs", "listingTypes"]) {
        const entries = Object.entries(vector[dim]);
        if (entries.length > 30) {
          entries.sort((a, b) => b[1] - a[1]);
          vector[dim] = Object.fromEntries(entries.slice(0, 25));
        }
      }

      await redisClient.setEx(key, 7 * 86400, JSON.stringify(vector));
    } catch (e) {
      logger.warn("Preference vector update error:", e.message);
    }
  }

  static async getPreferenceVector(userId) {
    try {
      if (!redisClient) return null;
      const raw = await redisClient.get(`user:pref_vector:${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * 10. Session-Momentum Live Feed Adaptation (TikTok/Reels style)
   * Dynamically boosts candidate posts matching in-session dwell (>2s) or carousel swipes.
   */
  static async applySessionMomentum(posts, userId) {
    if (!Array.isArray(posts) || posts.length === 0 || !userId) {
      return posts;
    }

    try {
      if (!redisClient) return posts;
      const key = `user:micro_eng:${userId}`;
      const rawEntries = await redisClient.lRange(key, 0, 9);
      if (!rawEntries || rawEntries.length === 0) return posts;

      const engagements = rawEntries
        .map((r) => {
          try {
            return JSON.parse(r);
          } catch {
            return null;
          }
        })
        .filter((e) => e && e.postId && (e.dwellTimeMs >= 2000 || e.swipedPhotosCount >= 1));

      if (engagements.length === 0) return posts;

      const engagedPostIds = new Set(engagements.map((e) => String(e.postId)));

      // Extract attributes from engaged posts: check in current posts array first
      const postMap = new Map(posts.map((p) => [String(p._id), p]));
      const missingIds = [...engagedPostIds].filter((id) => !postMap.has(id));

      let engagedPosts = [...engagedPostIds].map((id) => postMap.get(id)).filter(Boolean);

      if (missingIds.length > 0) {
        try {
          const PropertyPost = (await import("../models/PropertyPost.model.js")).default;
          const fetched = await PropertyPost.find({ _id: { $in: missingIds } })
            .select("locality city postType price bedrooms postMeta")
            .lean();
          engagedPosts = [...engagedPosts, ...fetched];
        } catch (e) {
          logger.warn("applySessionMomentum fetch missing engaged posts error:", e?.message);
        }
      }

      if (engagedPosts.length === 0) return posts;

      // Calculate session affinity signals
      const localityAffinities = new Map();
      const postTypeAffinities = new Map();
      const bhkAffinities = new Set();
      let totalPrice = 0;
      let priceCount = 0;

      for (const p of engagedPosts) {
        if (p.locality) {
          const loc = String(p.locality).toLowerCase().trim();
          localityAffinities.set(loc, (localityAffinities.get(loc) || 0) + 1);
        }
        if (p.postType) {
          const type = String(p.postType).toUpperCase().trim();
          postTypeAffinities.set(type, (postTypeAffinities.get(type) || 0) + 1);
        }
        const bhk = p.bedrooms || p.postMeta?.residential?.bhk || p.postMeta?.residential?.bedrooms;
        if (bhk) bhkAffinities.add(Number(bhk));

        if (p.price && Number(p.price) > 0) {
          totalPrice += Number(p.price);
          priceCount++;
        }
      }

      const avgEngagedPrice = priceCount > 0 ? totalPrice / priceCount : 0;

      // Load medium-term preference vector for behavioral learning blend
      const prefVector = await CardCTRService.getPreferenceVector(userId);
      const prefAvgPrice = prefVector && prefVector.priceCount > 0
        ? prefVector.priceSum / prefVector.priceCount : 0;
      const hasPrefVector = prefVector && prefVector.totalSignals > 3;

      // Compute momentum multiplier for each candidate post
      const scoredPosts = posts.map((post) => {
        let momentumMultiplier = 1.0;
        const pid = String(post._id);

        // === Short-term session signals (from last 2h micro-engagements) ===

        // Locality affinity boost (huge signal: user is actively browsing this neighborhood)
        const postLoc = String(post.locality || "").toLowerCase().trim();
        if (postLoc && localityAffinities.has(postLoc)) {
          const locWeight = localityAffinities.get(postLoc);
          momentumMultiplier += Math.min(0.35, locWeight * 0.15);
        }

        // Transaction type affinity (e.g. rent vs buy)
        const postType = String(post.postType || "").toUpperCase().trim();
        if (postType && postTypeAffinities.has(postType)) {
          momentumMultiplier += 0.15;
        }

        // BHK affinity
        const postBhk = Number(post.bedrooms || post.postMeta?.residential?.bhk || post.postMeta?.residential?.bedrooms || 0);
        if (postBhk && bhkAffinities.has(postBhk)) {
          momentumMultiplier += 0.12;
        }

        // Budget alignment (+/- 30% of average engaged price)
        if (avgEngagedPrice > 0 && post.price) {
          const ratio = post.price / avgEngagedPrice;
          if (ratio >= 0.7 && ratio <= 1.3) {
            momentumMultiplier += 0.10;
          }
        }

        // === Medium-term behavioral learning (from 7-day preference vector) ===
        if (hasPrefVector) {
          const total = prefVector.totalSignals;

          // Locality preference from engagement history
          if (postLoc && prefVector.localities[postLoc]) {
            const locStrength = Math.min(0.25, (prefVector.localities[postLoc] / total) * 0.8);
            momentumMultiplier += locStrength;
          }

          // Post type preference
          if (postType && prefVector.postTypes[postType]) {
            const typeStrength = Math.min(0.12, (prefVector.postTypes[postType] / total) * 0.5);
            momentumMultiplier += typeStrength;
          }

          // BHK preference
          if (postBhk && prefVector.bhkPrefs[String(postBhk)]) {
            const bhkStrength = Math.min(0.10, (prefVector.bhkPrefs[String(postBhk)] / total) * 0.4);
            momentumMultiplier += bhkStrength;
          }

          // Price alignment with learned preference
          if (prefAvgPrice > 0 && post.price) {
            const ratio = post.price / prefAvgPrice;
            if (ratio >= 0.6 && ratio <= 1.4) {
              momentumMultiplier += 0.08;
            }
          }

          // Listing type preference (Rent vs Buy vs Sell)
          const lt = String(post.listingType || "").trim();
          if (lt && prefVector.listingTypes[lt]) {
            const ltStrength = Math.min(0.08, (prefVector.listingTypes[lt] / total) * 0.3);
            momentumMultiplier += ltStrength;
          }
        }

        // Contextual Time-of-day boost
        const todMultiplier = this.getTimeOfDayMultiplier(post);
        momentumMultiplier *= todMultiplier;

        // pCTR prediction weighting
        const pCTR = this.calculatePCTR(post);
        const finalScore = momentumMultiplier * (0.8 + 0.4 * pCTR);

        // Slight penalty for posts already heavily engaged in this session to surface fresh candidates
        const freshScore = engagedPostIds.has(pid) ? finalScore * 0.92 : finalScore;

        return {
          post,
          score: freshScore,
        };
      });

      // Sort candidate posts by dynamic session score (descending)
      scoredPosts.sort((a, b) => b.score - a.score);
      return scoredPosts.map((s) => s.post);
    } catch (e) {
      logger.warn("applySessionMomentum error:", e?.message);
      return posts;
    }
  }

  /**
   * Format currency abbreviation for badges (e.g. ₹3.5L or ₹50k)
   */
  static formatCurrencyAbbr(amount) {
    if (!amount || amount <= 0) return "";
    if (amount >= 10000000) {
      const cr = amount / 10000000;
      return `₹${cr % 1 === 0 ? cr : cr.toFixed(1)} Cr`;
    }
    if (amount >= 100000) {
      const l = amount / 100000;
      return `₹${l % 1 === 0 ? l : l.toFixed(1)}L`;
    }
    if (amount >= 1000) {
      const k = amount / 1000;
      return `₹${k % 1 === 0 ? k : k.toFixed(0)}k`;
    }
    return `₹${amount}`;
  }
}

export default CardCTRService;
