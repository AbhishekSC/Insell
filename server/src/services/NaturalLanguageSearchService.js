import PropertyPost from "../models/PropertyPost.model.js";
import { CITY_CENTROIDS } from "../utils/cityCentroids.js";
import { logger } from "../utils/logger.js";
import PersonalizationService from "./PersonalizationService.js";

// Multipliers for Indian currency denominations
const MULTIPLIERS = {
  cr: 10_000_000,
  crore: 10_000_000,
  crores: 10_000_000,
  l: 100_000,
  lac: 100_000,
  lacs: 100_000,
  lakh: 100_000,
  lakhs: 100_000,
  k: 1_000,
  thousand: 1_000,
  thousands: 1_000,
};

// Common Indian cities for direct matching
const KNOWN_CITIES = Object.keys(CITY_CENTROIDS);

// Amenity regex patterns mapped to standard tag keys
const AMENITY_PATTERNS = [
  { key: "garden", regex: /\b(garden|park|lawn|green space)\b/i },
  { key: "swimming pool", regex: /\b(pool|swimming pool)\b/i },
  { key: "gym", regex: /\b(gym|fitness|workout)\b/i },
  { key: "parking", regex: /\b(parking|car park|covered parking|garage)\b/i },
  { key: "balcony", regex: /\b(balcony|terrace|deck)\b/i },
  { key: "lift", regex: /\b(lift|elevator)\b/i },
  { key: "clubhouse", regex: /\b(clubhouse|club house)\b/i },
  { key: "gated", regex: /\b(gated|security|24x7 security|cctv)\b/i },
  { key: "power backup", regex: /\b(power backup|generator|inverter)\b/i },
  { key: "furnished", regex: /\b(fully furnished|furnished)\b/i },
  { key: "semi-furnished", regex: /\b(semi furnished|semi-furnished)\b/i },
  { key: "unfurnished", regex: /\b(unfurnished)\b/i },
  { key: "pet friendly", regex: /\b(pet friendly|pets allowed)\b/i },
];

// Transport keywords
const TRANSPORT_PATTERNS = [
  { type: "metro", regex: /\b(near metro|metro station|close to metro)\b/i },
  { type: "station", regex: /\b(near station|railway station|train station)\b/i },
  { type: "highway", regex: /\b(near highway|expressway|ring road)\b/i },
  { type: "airport", regex: /\b(near airport|airport road)\b/i },
];

// Property type mapping
const PROPERTY_TYPE_PATTERNS = [
  { type: "Apartment", regex: /\b(apartment|apartments|flat|flats|condo|society)\b/i },
  { type: "Villa", regex: /\b(villa|villas|bungalow|bungalows|row house|duplex)\b/i },
  { type: "Independent House", regex: /\b(independent house|independent home|kothi|house)\b/i },
  { type: "Plot", regex: /\b(plot|plots|land|farmland|agricultural land)\b/i },
  { type: "Commercial", regex: /\b(commercial|office|office space|shop|retail|showroom|warehouse)\b/i },
  { type: "PG/Hostel", regex: /\b(pg|hostel|co-living|paying guest)\b/i },
];

/**
 * Convert string number with optional unit into integer rupees
 */
function parsePriceValue(val, unit, isRent = false) {
  const num = parseFloat(val);
  if (isNaN(num)) return null;

  if (unit && MULTIPLIERS[unit.toLowerCase()]) {
    return Math.round(num * MULTIPLIERS[unit.toLowerCase()]);
  }

  // Unit inferred from context
  if (isRent) {
    // If under 200 without unit, assume thousands (e.g., 25 -> 25,000)
    if (num <= 250) return Math.round(num * 1_000);
    return Math.round(num);
  } else {
    // For buy, if <= 500, assume lakhs (e.g. 50 -> 50,00,000)
    if (num <= 500) return Math.round(num * 100_000);
    return Math.round(num);
  }
}

/**
 * Parse a free-form natural language query into structured property search filters
 *
 * Example:
 *   "2BHK near metro under 50 lakhs in Pune with garden"
 *   -> {
 *        bedrooms: 2,
 *        propertyType: "Apartment",
 *        city: "Pune",
 *        maxPrice: 5000000,
 *        amenities: ["garden"],
 *        nearTransport: true,
 *        intent: "buy"
 *      }
 */
export function parseNaturalQuery(queryStr = "") {
  const raw = String(queryStr).trim();
  if (!raw) return { raw: "", isValid: false };

  let text = raw.toLowerCase();
  const parsed = {
    raw,
    bedrooms: null,
    propertyType: null,
    postType: null,
    listingType: null,
    intent: "buy", // default to buy
    city: null,
    localityHint: null,
    minPrice: null,
    maxPrice: null,
    amenities: [],
    nearTransport: false,
    transportTypes: [],
    residualKeywords: [],
  };

  // 1. Detect Intent (Buy vs Rent vs Invest)
  if (/\b(rent|rental|lease|to rent|for rent|tenant|paying guest|pg)\b/i.test(text)) {
    parsed.intent = "rent";
    parsed.listingType = "Rent";
    parsed.postType = "PROPERTY_RENT";
  } else if (/\b(invest|investment|roi|high return)\b/i.test(text)) {
    parsed.intent = "invest";
    parsed.listingType = "Buy";
    parsed.postType = "PROPERTY_SALE";
  } else {
    parsed.intent = "buy";
    parsed.listingType = "Buy";
    parsed.postType = "PROPERTY_SALE";
  }

  // 2. Extract BHK / Bedrooms
  const bhkMatch = text.match(/\b(\d+)\s*(?:bhk|bedroom|bed|rk)\b/i);
  if (bhkMatch) {
    parsed.bedrooms = parseInt(bhkMatch[1], 10);
  } else if (/\bstudio\b/i.test(text)) {
    parsed.bedrooms = 1;
  }

  // 3. Extract Property Type
  for (const { type, regex } of PROPERTY_TYPE_PATTERNS) {
    if (regex.test(text)) {
      parsed.propertyType = type;
      break;
    }
  }
  // Default residential to Apartment if BHK was specified but type was omitted
  if (parsed.bedrooms && !parsed.propertyType) {
    parsed.propertyType = "Apartment";
  }

  // 4. Extract Price Range
  const isRent = parsed.intent === "rent";

  // Between X and Y (unit on either or both: "between 1.2 cr and 1.8 cr" or "between 50 and 70 lakhs")
  const betweenMatch = text.match(
    /\b(?:between|from)\s+([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|l|k|thousand|thousands)?\s*(?:to|and|-)\s*([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|l|k|thousand|thousands)?\b/i
  );
  if (betweenMatch) {
    const unit1 = betweenMatch[2] || betweenMatch[4] || null;
    const unit2 = betweenMatch[4] || betweenMatch[2] || null;
    parsed.minPrice = parsePriceValue(betweenMatch[1], unit1, isRent);
    parsed.maxPrice = parsePriceValue(betweenMatch[3], unit2, isRent);
  } else {
    // Range with dash: "50-70 lakhs", "1.2-1.5 cr"
    const dashRangeMatch = text.match(
      /\b([\d.]+)\s*-\s*([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|l|k|thousand|thousands)\b/i
    );
    if (dashRangeMatch) {
      const unit = dashRangeMatch[3];
      parsed.minPrice = parsePriceValue(dashRangeMatch[1], unit, isRent);
      parsed.maxPrice = parsePriceValue(dashRangeMatch[2], unit, isRent);
    } else {
      // Under / below / max
      const maxMatch = text.match(
        /\b(?:under|below|less than|max|up to|within)\s+([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|l|k|thousand|thousands)?\b/i
      );
      if (maxMatch) {
        parsed.maxPrice = parsePriceValue(maxMatch[1], maxMatch[2], isRent);
      }

      // Above / min / starting from
      const minMatch = text.match(
        /\b(?:above|more than|min|starting from|greater than)\s+([\d.]+)\s*(cr|crore|crores|lakh|lakhs|lac|lacs|l|k|thousand|thousands)?\b/i
      );
      if (minMatch) {
        parsed.minPrice = parsePriceValue(minMatch[1], minMatch[2], isRent);
      }
    }
  }

  // 5. Extract City
  for (const city of KNOWN_CITIES) {
    // Match whole city name with word boundary
    const cityRegex = new RegExp(`\\b${city.replace("-", "[ -]")}\\b`, "i");
    if (cityRegex.test(text)) {
      // Capitalize first letter of each word
      parsed.city = city
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      break;
    }
  }

  // 6. Extract Amenities
  for (const { key, regex } of AMENITY_PATTERNS) {
    if (regex.test(text)) {
      parsed.amenities.push(key);
    }
  }

  // 7. Extract Transport / Transit
  for (const { type, regex } of TRANSPORT_PATTERNS) {
    if (regex.test(text)) {
      parsed.nearTransport = true;
      parsed.transportTypes.push(type);
    }
  }

  // 8. Extract Locality Hint (e.g., "in Kharadi", "near Hinjewadi", "at Whitefield")
  const localityMatch = text.match(/\b(?:in|at|near|around)\s+([a-zA-Z]{3,20})\b/i);
  if (localityMatch) {
    const candidate = localityMatch[1].trim();
    const candidateLower = candidate.toLowerCase();
    const isCity = parsed.city && parsed.city.toLowerCase() === candidateLower;
    const isKnownStopword = [
      "metro", "station", "garden", "gym", "pool", "budget", "pune", "mumbai", "delhi",
      "under", "between", "around", "with", "for", "rent", "buy", "sale", "flat", "apartment"
    ].includes(candidateLower);

    if (!isCity && !isKnownStopword) {
      parsed.localityHint = candidate.charAt(0).toUpperCase() + candidate.slice(1);
    }
  }

  // 9. Clean Residual Keywords (for MongoDB text/regex fallback)
  const stopWords = [
    "in", "at", "near", "under", "below", "with", "for", "and", "or", "to", "between",
    "bhk", "bedroom", "flat", "apartment", "house", "villa", "property", "looking", "want", "need",
    "lakh", "lakhs", "lac", "lacs", "cr", "crore", "crores", "k", "thousand", "thousands",
    "rent", "buy", "sale", "metro", "garden", "pool", "gym", "lift", "amenities",
    ...(parsed.city ? parsed.city.toLowerCase().split(" ") : []),
  ];

  const words = text
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => {
      if (w.length < 3) return false;
      if (stopWords.includes(w)) return false;
      if (/^\d+(?:bhk|rk|k|l|cr)?$/i.test(w)) return false;
      if (!isNaN(w)) return false;
      return true;
    });

  parsed.residualKeywords = [...new Set(words)];

  parsed.isValid = Boolean(
    parsed.bedrooms ||
    parsed.propertyType ||
    parsed.city ||
    parsed.maxPrice ||
    parsed.minPrice ||
    parsed.amenities.length > 0 ||
    parsed.localityHint ||
    parsed.residualKeywords.length > 0
  );

  return parsed;
}

/**
 * Execute natural language search against MongoDB, then rank and diversify results
 *
 * @param {Object} options
 * @param {string} options.query - Free-form search string
 * @param {string} options.currentUserId - Authenticated user ID (optional)
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Max items to return
 */
export async function executeNaturalSearch({
  query = "",
  currentUserId = null,
  page = 1,
  limit = 12,
}) {
  const parsed = parseNaturalQuery(query);
  const skip = (Math.max(1, page) - 1) * limit;

  // Build MongoDB query filter
  const filter = {
    isDeleted: { $ne: true },
    isBlocked: { $ne: true },
    status: "PUBLISHED",
    visibility: "PUBLIC",
  };

  // City match
  if (parsed.city) {
    filter.city = { $regex: new RegExp(`^${parsed.city}`, "i") };
  }

  // BHK / Bedrooms
  if (parsed.bedrooms) {
    filter.bedrooms = parsed.bedrooms;
  }

  // Property Type
  if (parsed.propertyType) {
    filter.propertyType = { $regex: new RegExp(parsed.propertyType, "i") };
  }

  // Post Type / Intent
  if (parsed.postType) {
    // Also allow legacy posts where postType might be slightly different or null
    filter.$or = [
      { postType: parsed.postType },
      { listingType: parsed.listingType },
    ];
  }

  // Price Range
  if (parsed.minPrice !== null || parsed.maxPrice !== null) {
    filter.price = {};
    if (parsed.minPrice !== null) filter.price.$gte = parsed.minPrice;
    if (parsed.maxPrice !== null) filter.price.$lte = parsed.maxPrice;
  }

  // Locality hint or residual keywords
  const searchTerms = [
    parsed.localityHint,
    ...parsed.residualKeywords,
  ].filter(Boolean);

  if (searchTerms.length > 0) {
    const termRegexes = searchTerms.map((t) => new RegExp(t, "i"));
    const textConditions = termRegexes.map((reg) => ({
      $or: [
        { title: reg },
        { locality: reg },
        { caption: reg },
        { "postMeta.residential.furnishing": reg },
      ],
    }));

    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, ...textConditions];
      delete filter.$or;
    } else {
      filter.$and = textConditions;
    }
  }

  logger.info(`🔍 [NATURAL SEARCH] Query: "${query}" -> Parsed:`, {
    city: parsed.city,
    bedrooms: parsed.bedrooms,
    propertyType: parsed.propertyType,
    intent: parsed.intent,
    priceRange: [parsed.minPrice, parsed.maxPrice],
    amenities: parsed.amenities,
    nearTransport: parsed.nearTransport,
    localityHint: parsed.localityHint,
  });

  // Query database with candidate pool (limit * 3) for MMR re-ranking
  const candidatePoolSize = Math.max(limit * 3, 30);

  const [candidates, total] = await Promise.all([
    PropertyPost.find(filter)
      .sort({ createdAt: -1 })
      .limit(candidatePoolSize)
      .populate("author", "fullName profilePic isVerified isOwnerVerified ratingAvg ratingCount responseRate")
      .lean(),
    PropertyPost.countDocuments(filter),
  ]);

  if (candidates.length === 0) {
    // If structured match found 0, attempt a looser fallback search
    const looserFilter = {
      isDeleted: { $ne: true },
      isBlocked: { $ne: true },
      status: "PUBLISHED",
      visibility: "PUBLIC",
    };
    if (parsed.city) looserFilter.city = { $regex: new RegExp(`^${parsed.city}`, "i") };
    if (parsed.bedrooms) looserFilter.bedrooms = parsed.bedrooms;

    const [fallbackCandidates, fallbackTotal] = await Promise.all([
      PropertyPost.find(looserFilter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("author", "fullName profilePic isVerified isOwnerVerified ratingAvg ratingCount responseRate")
        .lean(),
      PropertyPost.countDocuments(looserFilter),
    ]);

    return {
      query,
      parsed,
      isFallback: fallbackCandidates.length > 0,
      total: fallbackTotal,
      posts: fallbackCandidates,
      pagination: {
        page,
        limit,
        total: fallbackTotal,
        totalPages: Math.max(1, Math.ceil(fallbackTotal / limit)),
      },
    };
  }

  // Score candidate properties with relevance to the parsed search
  const scored = candidates.map((prop) => {
    let matchScore = 50;

    // Direct bedroom match
    if (parsed.bedrooms && prop.bedrooms === parsed.bedrooms) matchScore += 20;

    // Direct city match
    if (parsed.city && prop.city && prop.city.toLowerCase() === parsed.city.toLowerCase()) matchScore += 15;

    // Locality match
    if (parsed.localityHint && prop.locality && new RegExp(parsed.localityHint, "i").test(prop.locality)) matchScore += 20;

    // Price competitiveness inside range
    if (parsed.maxPrice && prop.price && prop.price <= parsed.maxPrice) {
      const ratio = prop.price / parsed.maxPrice;
      if (ratio >= 0.7 && ratio <= 1.0) matchScore += 10;
    }

    // Amenity matches
    if (parsed.amenities.length > 0) {
      const propText = `${prop.title} ${prop.caption} ${JSON.stringify(prop.postMeta?.amenities || "")}`.toLowerCase();
      let matchedAmenities = 0;
      for (const a of parsed.amenities) {
        if (propText.includes(a)) matchedAmenities++;
      }
      matchScore += Math.min(15, matchedAmenities * 5);
    }

    return {
      ...prop,
      matchScore,
      finalScore: matchScore,
    };
  });

  // Apply MMR diversity re-ranking to avoid showing identical listings
  const reranked = PersonalizationService.mmrRerank(scored, limit, 0.75);

  return {
    query,
    parsed,
    isFallback: false,
    total,
    posts: reranked.slice(skip, skip + limit),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
