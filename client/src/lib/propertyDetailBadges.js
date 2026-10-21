// Builds the small pill-shaped detail tags shown under a property post's
// price/title (bedrooms, bathrooms, area, role-specific extras). Shared by
// the marketplace feed and the profile page's Posts/Saved grids so both show
// the same real data — only pushes a tag when the underlying field actually
// exists, instead of always showing "0 Beds / 0 Baths / 0 sqft".
//
// Universal helper to resolve spaceType for any property post
export function getPostSpaceType(post) {
  if (!post) return "";
  const meta = post.postMeta || {};
  const res = meta.residential || {};
  const comm = meta.commercial || {};
  const land = meta.land || {};
  const pg = meta.pgHostel || {};

  // 1. Explicitly defined spaceType on post or postMeta
  const explicit =
    res.spaceType ||
    meta.spaceType ||
    post.spaceType ||
    pg.spaceType ||
    pg.roomType;
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim();
  }

  // 2. Specialized post types
  const postTypeUpper = String(post.postType || "").toUpperCase();
  if (postTypeUpper.startsWith("REQUIREMENT_")) {
    return meta.requirement?.spaceType || meta.requirement?.propertyType || "";
  }
  if (postTypeUpper === "COMMERCIAL_LISTING" || comm.commercialType) {
    return comm.commercialType || "Commercial";
  }
  if (postTypeUpper === "AGRICULTURAL_LISTING" || Number(land.landArea) > 0 || post.propertyType === "Agricultural Land") {
    return "Plot / Land";
  }
  if (postTypeUpper === "PG_HOSTEL" || meta.pgHostel) {
    return "PG / Hostel";
  }

  // 3. Residential property fallback
  if (post.propertyType && !["Other", "Residential"].includes(post.propertyType)) {
    return post.propertyType;
  }
  return "Entire Flat";
}

// Helper to resolve the exact electricity bill verification status enum
export function getAddressVerificationStatus(post) {
  if (!post) return "NONE";
  const meta = post.postMeta || {};
  const res = meta.residential || {};
  const comm = meta.commercial || {};
  const land = meta.land || {};
  const pg = meta.pgHostel || {};

  const status =
    res.electricityBillStatus ||
    meta.electricityBillStatus ||
    comm.electricityBillStatus ||
    land.electricityBillStatus ||
    pg.electricityBillStatus ||
    post.electricityBillStatus;

  if (status) return String(status).toUpperCase();
  if (post.addressVerified) return "VERIFIED";
  if (res.electricityBillUrl || meta.electricityBillUrl || comm.electricityBillUrl || land.electricityBillUrl) {
    return "PENDING";
  }
  return "NONE";
}

// activeRole is optional — pass it (from MarketplacePage's role switcher) to
// also include role-specific postMeta fields; omit it (as the profile page
// does, which has no concept of "viewing as a role") to get just the
// universal fields.
export function buildPropertyDetailBadges(post, activeRole) {
  const details = [];

  const land = post.postMeta?.land || {};
  const commercial = post.postMeta?.commercial || {};
  const postTypeUpper = String(post.postType || "").toUpperCase();
  // Also treat a post as land/commercial when it carries that meta even if
  // postType is a legacy PROPERTY_SALE (older posts predate roles being
  // allowed to create these types).
  const isLand = postTypeUpper === "AGRICULTURAL_LISTING"
    || Number(land.landArea) > 0
    || post.propertyType === "Agricultural Land";
  const isCommercial = postTypeUpper === "COMMERCIAL_LISTING"
    || Boolean(commercial.commercialType)
    || Number(commercial.carpetArea) > 0;

  if (isLand) {
    if (land.landArea) details.push({ label: `${land.landArea} ${land.landAreaUnit || ""}`.trim(), color: "bg-slate-100", textColor: "text-slate-700" });
    if (land.soilType) details.push({ label: land.soilType, color: "bg-slate-100", textColor: "text-slate-700" });
    if (land.waterAvailability) details.push({ label: land.waterAvailability, color: "bg-blue-50", textColor: "text-blue-700" });
    if (land.roadAccess) details.push({ label: "Road Access", color: "bg-slate-100", textColor: "text-slate-700" });
  } else if (isCommercial) {
    if (commercial.commercialType) details.push({ label: commercial.commercialType, color: "bg-slate-100", textColor: "text-slate-700" });
    if (commercial.carpetArea) details.push({ label: `${Number(commercial.carpetArea)} sqft carpet`, color: "bg-slate-100", textColor: "text-slate-700" });
    if (commercial.floorNumber) details.push({ label: `Floor ${commercial.floorNumber}`, color: "bg-slate-100", textColor: "text-slate-700" });
    if (post.areaSqft) details.push({ label: `${Number(post.areaSqft)} sqft`, color: "bg-slate-100", textColor: "text-slate-700" });
  } else {
    const spaceType = getPostSpaceType(post);
    if (spaceType) {
      details.push({ label: spaceType, color: "bg-slate-100", textColor: "text-slate-700", isSpaceType: true });
    }
    if (post.bedrooms) details.push({ label: `${post.bedrooms} BHK`, color: "bg-slate-100", textColor: "text-slate-700" });
    if (post.bathrooms) details.push({ label: `${post.bathrooms} Baths`, color: "bg-slate-100", textColor: "text-slate-700" });
    if (post.areaSqft) details.push({ label: `${Number(post.areaSqft)} sqft`, color: "bg-slate-100", textColor: "text-slate-700" });
    if (post.propertyType && post.propertyType !== spaceType) details.push({ label: post.propertyType, color: "bg-slate-100", textColor: "text-slate-700" });
  }

  if (activeRole === "Tenant") {
    if (post.postMeta?.furnishing) details.push({ label: post.postMeta.furnishing, color: "bg-indigo-50", textColor: "text-indigo-700" });
    if (post.postMeta?.occupancy) details.push({ label: post.postMeta.occupancy, color: "bg-indigo-50", textColor: "text-indigo-700" });
    if (post.postMeta?.amenities?.length) details.push({ label: `${post.postMeta.amenities.length} Amenities`, color: "bg-emerald-50", textColor: "text-emerald-700" });
  } else if (activeRole === "Buyer") {
    if (post.postMeta?.possessionStatus) details.push({ label: post.postMeta.possessionStatus, color: "bg-emerald-50", textColor: "text-emerald-700" });
    if (post.postMeta?.reraVerified) details.push({ label: "RERA Verified", color: "bg-blue-50", textColor: "text-blue-700" });
    if (post.postMeta?.ageOfProperty) details.push({ label: post.postMeta.ageOfProperty, color: "bg-slate-100", textColor: "text-slate-700" });
    if (post.postMeta?.parking) details.push({ label: "Parking", color: "bg-slate-100", textColor: "text-slate-700" });
  } else if (activeRole === "Seller") {
    if (post.engagementScore) details.push({ label: `Score: ${post.engagementScore}`, color: "bg-indigo-50", textColor: "text-indigo-700" });
    if (post.postMeta?.daysListed) details.push({ label: `${post.postMeta.daysListed} days`, color: "bg-slate-100", textColor: "text-slate-700" });
  } else if (activeRole === "Broker") {
    if (post.postMeta?.leadQuality) details.push({ label: post.postMeta.leadQuality, color: "bg-emerald-50", textColor: "text-emerald-700" });
    if (post.postMeta?.commissionRate) details.push({ label: `${post.postMeta.commissionRate}% Comm`, color: "bg-amber-50", textColor: "text-amber-700" });
    if (post.postMeta?.isUrgent) details.push({ label: "Urgent", color: "bg-red-50", textColor: "text-red-700" });
  } else if (activeRole === "Builder") {
    if (post.postMeta?.projectStatus) details.push({ label: post.postMeta.projectStatus, color: "bg-blue-50", textColor: "text-blue-700" });
    if (post.postMeta?.reraNumber) details.push({ label: "RERA Registered", color: "bg-emerald-50", textColor: "text-emerald-700" });
    if (post.postMeta?.launchYear) details.push({ label: post.postMeta.launchYear, color: "bg-slate-100", textColor: "text-slate-700" });
  } else if (activeRole === "Investor") {
    if (post.postMeta?.roi) details.push({ label: `${post.postMeta.roi}% ROI`, color: "bg-emerald-50", textColor: "text-emerald-700" });
    if (post.postMeta?.investmentType) details.push({ label: post.postMeta.investmentType, color: "bg-indigo-50", textColor: "text-indigo-700" });
    if (post.postMeta?.timeHorizon) details.push({ label: post.postMeta.timeHorizon, color: "bg-slate-100", textColor: "text-slate-700" });
  }

  if (post.postMeta?.facing) details.push({ label: post.postMeta.facing, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.postMeta?.floorNumber) details.push({ label: `Floor ${post.postMeta.floorNumber}`, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.postMeta?.totalFloors) details.push({ label: `${post.postMeta.totalFloors} Floors`, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.postMeta?.maintenanceCharges) details.push({ label: `₹${post.postMeta.maintenanceCharges}/mo`, color: "bg-slate-100", textColor: "text-slate-700" });

  return details;
}

// Curates 1-3 catchy, high-signal highlights based on actual property data
// (Address Verified, Furnishing, Preferred Tenants, Space Type, Standout Amenities, Facing).
// Avoids clutter: returns only the top most relevant badges for each post.
export function buildCatchyPropertyBadges(post, max = 2) {
  if (!post) return [];
  const meta = post.postMeta || {};
  const res = meta.residential || {};
  const commercial = meta.commercial || {};
  const land = meta.land || {};

  const candidates = [];

  // 1. Address Verified (High Trust Signal)
  const isVerified =
    Boolean(post.addressVerified) ||
    res.electricityBillStatus === "VERIFIED" ||
    meta.electricityBillStatus === "VERIFIED";
  if (isVerified) {
    candidates.push({
      key: "verified",
      label: "✓ Address Verified",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold",
      priority: 1,
    });
  }

  // 2. Space Type (e.g. Private Room, Shared Room, PG)
  const spaceType = res.spaceType || meta.spaceType;
  if (spaceType && spaceType !== "Entire Flat") {
    candidates.push({
      key: "spaceType",
      label: spaceType,
      className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-medium",
      priority: 2,
    });
  }

  // 3. Furnishing
  const furnishing = res.furnishing || meta.furnishing || meta.requirement?.furnishedPreference;
  if (furnishing) {
    candidates.push({
      key: "furnishing",
      label: furnishing,
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium",
      priority: 3,
    });
  }

  // 4. Preferred Tenants
  const tenants = Array.isArray(res.preferredTenants) && res.preferredTenants.length > 0
    ? res.preferredTenants
    : Array.isArray(meta.preferredTenants)
      ? meta.preferredTenants
      : [];
  if (tenants.length > 0) {
    const hasBachelor = tenants.some((t) => /bachelor|male|female/i.test(t));
    const hasFamily = tenants.some((t) => /family/i.test(t));
    const hasStudents = tenants.some((t) => /student/i.test(t));
    const hasWorking = tenants.some((t) => /working|professional/i.test(t));

    let tenantLabel = tenants[0];
    if (hasBachelor && hasFamily) tenantLabel = "All Tenants Welcome";
    else if (hasBachelor) tenantLabel = "Bachelors Welcome";
    else if (hasFamily) tenantLabel = "Family Friendly";
    else if (hasStudents) tenantLabel = "Students Welcome";
    else if (hasWorking) tenantLabel = "Working Pros Welcome";

    candidates.push({
      key: "tenants",
      label: tenantLabel,
      className: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-medium",
      priority: 4,
    });
  }

  // 5. Facing (Vastu / Sunlight)
  const facing = res.facing || meta.facing;
  if (facing) {
    candidates.push({
      key: "facing",
      label: `${facing} Facing`.replace(/Facing Facing/i, "Facing"),
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-medium",
      priority: 5,
    });
  }

  // 6. Standout Amenities
  const amenities = Array.isArray(meta.amenities) && meta.amenities.length > 0
    ? meta.amenities
    : Array.isArray(res.amenities) && res.amenities.length > 0
      ? res.amenities
      : [];
  if (amenities.length > 0) {
    const hay = amenities.map((a) => String(a).toLowerCase());
    const hasAC = hay.some((a) => a.includes("ac") || a.includes("air cond"));
    const hasWifi = hay.some((a) => a.includes("wifi") || a.includes("internet"));
    const hasParking = hay.some((a) => a.includes("parking"));
    const hasCCTV = hay.some((a) => a.includes("cctv") || a.includes("security"));
    const hasGym = hay.some((a) => a.includes("gym"));

    let amenLabel = null;
    if (hasAC && hasWifi) amenLabel = "AC & WiFi";
    else if (hasParking) amenLabel = "Covered Parking";
    else if (hasCCTV) amenLabel = "CCTV Security";
    else if (hasGym) amenLabel = "Gym Access";
    else if (amenities.length >= 3) amenLabel = `${amenities.length}+ Amenities`;

    if (amenLabel) {
      candidates.push({
        key: "amenity",
        label: amenLabel,
        className: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 font-medium",
        priority: 6,
      });
    }
  }

  // 7. Commercial type specifics
  if (commercial.commercialType) {
    candidates.push({
      key: "commType",
      label: commercial.commercialType,
      className: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 font-medium",
      priority: 2,
    });
  }

  // 8. Agricultural specifics
  if (land.roadAccess) {
    candidates.push({
      key: "road",
      label: "Road Facing",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-medium",
      priority: 3,
    });
  }
  if (land.waterAvailability && land.waterAvailability !== "None") {
    candidates.push({
      key: "water",
      label: `${land.waterAvailability} Water`,
      className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 font-medium",
      priority: 4,
    });
  }

  // 9. Age of Property
  const age = res.ageOfProperty || meta.ageOfProperty;
  if (age === "Under 1 year" || age === "Under 1 Year") {
    candidates.push({
      key: "age",
      label: "Brand New",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-medium",
      priority: 7,
    });
  }

  // Sort by priority and take top `max`
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates.slice(0, max);
}

// Curated Clickable Badges Algorithm
// Dynamically analyzes property data and selects the top 3-4 highest-impact
// tags (Space Type, BHK, Trust/Direct Owner, Price Drop, Pet Friendly, Furnished).
// Each badge carries a `filterValue` so clicking it immediately filters the feed!
export function getCuratedCardBadges(post, options = {}) {
  const { max = 4, isOwnPost = false } = options;
  if (!post) return [];
  const meta = post.postMeta || {};
  const res = meta.residential || {};
  const comm = meta.commercial || {};
  const land = meta.land || {};
  const isRequirement = String(post.postType || "").toUpperCase().startsWith("REQUIREMENT_");
  if (isRequirement) return [];

  const candidates = [];

  // 1. Space Type (e.g. "Entire Flat", "Private Room", "PG", "Co-living")
  const spaceType = getPostSpaceType(post);
  if (spaceType) {
    candidates.push({
      key: "spaceType",
      label: spaceType,
      filterValue: spaceType,
      type: "spaceType",
      className: "bg-base-100 dark:bg-base-200/90 text-base-content/90 font-semibold border border-base-300 dark:border-base-content/20 hover:border-primary/60 hover:text-primary",
      priority: 1, // #1 slot
    });
  }

  // 2. Scale / BHK (e.g. "2 BHK" or sqft)
  if (post.bedrooms) {
    candidates.push({
      key: "bhk",
      label: `${post.bedrooms} BHK`,
      filterValue: `${post.bedrooms} BHK`,
      type: "specs",
      className: "bg-base-100 dark:bg-base-200/90 text-base-content/85 font-semibold border border-base-300 dark:border-base-content/20 hover:border-primary/60 hover:text-primary",
      priority: 2, // #2 slot
    });
  } else if (land.landArea) {
    candidates.push({
      key: "area",
      label: `${land.landArea} ${land.landAreaUnit || "Acre"}`.trim(),
      filterValue: "Land",
      type: "specs",
      className: "bg-base-100 dark:bg-base-200/90 text-base-content/85 font-semibold border border-base-300 dark:border-base-content/20 hover:border-primary/60 hover:text-primary",
      priority: 2,
    });
  } else if (comm.carpetArea) {
    candidates.push({
      key: "area",
      label: `${Number(comm.carpetArea)} sqft`,
      filterValue: "Commercial",
      type: "specs",
      className: "bg-base-100 dark:bg-base-200/90 text-base-content/85 font-semibold border border-base-300 dark:border-base-content/20 hover:border-primary/60 hover:text-primary",
      priority: 2,
    });
  }

  // 3. Trust Signal — Address Verification Status (VERIFIED, PENDING, REJECTED, NONE)
  const verificationStatus = getAddressVerificationStatus(post);

  if (verificationStatus === "VERIFIED") {
    candidates.push({
      key: "addressVerified",
      label: "✓ Address Verified",
      filterValue: "verified",
      type: "trust",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/20 hover:border-emerald-500/50",
      priority: 3,
    });
  } else if (isOwnPost && !post.isBlocked) {
    if (verificationStatus === "PENDING") {
      candidates.push({
        key: "verifyPrompt",
        label: "⏳ Awaiting Verification",
        isAction: true,
        action: "verifyAddress",
        type: "action",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold hover:bg-amber-500/20 hover:border-amber-500/50",
        priority: 3,
      });
    } else if (verificationStatus === "REJECTED") {
      candidates.push({
        key: "verifyPrompt",
        label: "⚠️ Verification Rejected",
        isAction: true,
        action: "verifyAddress",
        type: "action",
        className: "bg-error/10 text-error border border-error/30 font-semibold hover:bg-error/20 hover:border-error/50",
        priority: 3,
      });
    } else {
      candidates.push({
        key: "verifyPrompt",
        label: "⚡ Verify address to boost",
        isAction: true,
        action: "verifyAddress",
        type: "action",
        className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold hover:bg-amber-500/20 hover:border-amber-500/50",
        priority: 3,
      });
    }
  }

  // 4. Ready to Move (High-demand possession status)
  const possession = res.possessionStatus || meta.possessionStatus || meta.projectStatus;
  if (possession && /ready/i.test(possession)) {
    candidates.push({
      key: "possession",
      label: "Ready to Move",
      filterValue: "ready to move",
      type: "possession",
      className: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/30 font-semibold hover:bg-teal-500/20 hover:border-teal-500/50",
      priority: 4,
    });
  }

  // 5. Parking (Covered / Dedicated)
  const amenitiesList = Array.isArray(meta.amenities) ? meta.amenities : (Array.isArray(res.amenities) ? res.amenities : []);
  const hasCoveredParking = amenitiesList.some((a) => /covered\s*parking/i.test(a));
  const hasParking = hasCoveredParking || amenitiesList.some((a) => /parking/i.test(a)) || meta.parkingRequired || res.parkingRequired;
  if (hasParking) {
    candidates.push({
      key: "parking",
      label: hasCoveredParking ? "Covered Parking" : "Parking",
      filterValue: "parking",
      type: "amenity",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold hover:bg-emerald-500/20 hover:border-emerald-500/50",
      priority: 4,
    });
  }

  // 5. Price Drop (Urgent Deal)
  const rawPriceHistory = Array.isArray(post.priceHistory) ? post.priceHistory : [];
  const cleanHistory = rawPriceHistory
    .filter((entry) => Number(entry?.price) > 0)
    .sort((a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0))
    .reduce((acc, entry) => {
      const p = Number(entry.price);
      if (acc.length === 0 || acc[acc.length - 1].price !== p) {
        acc.push({ ...entry, price: p });
      }
      return acc;
    }, []);

  if (cleanHistory.length >= 2) {
    const prev = cleanHistory[cleanHistory.length - 2]?.price;
    const curr = cleanHistory[cleanHistory.length - 1]?.price;
    if (prev && curr && curr < prev) {
      const dropAmount = prev - curr;
      candidates.push({
        key: "priceDrop",
        label: `↓ ₹${dropAmount >= 1000 ? Math.round(dropAmount / 1000) + "k" : dropAmount} Drop`,
        filterValue: "price drop",
        type: "deal",
        className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-500/20 hover:border-emerald-500/50",
        priority: 4,
      });
    }
  }

  // 6. Furnishing (Fully Furnished / Semi Furnished)
  const furnishing = res.furnishing || meta.furnishing;
  if (furnishing && !/unfurnished/i.test(furnishing)) {
    candidates.push({
      key: "furnishing",
      label: furnishing === "Fully Furnished" ? "Furnished" : furnishing,
      filterValue: furnishing,
      type: "lifestyle",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-semibold hover:bg-blue-500/20 hover:border-blue-500/50",
      priority: 5,
    });
  }

  // 7. Pet Friendly (House rules or caption)
  const rules = String(Array.isArray(res.houseRules) ? res.houseRules.join(" ") : res.houseRules || "");
  const isPetFriendly = /pet\s*friendly|pets?\s*allowed/i.test(rules) || /pet\s*friendly/i.test(post.caption || "");
  if (isPetFriendly) {
    candidates.push({
      key: "petFriendly",
      label: "Pet Friendly",
      filterValue: "pet",
      type: "lifestyle",
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-semibold hover:bg-purple-500/20 hover:border-purple-500/50",
      priority: 5,
    });
  }

  // 8. Bachelors Welcome
  const tenants = Array.isArray(res.preferredTenants) ? res.preferredTenants : [];
  const allowsBachelors = tenants.some((t) => /bachelor|student|any/i.test(t));
  if (allowsBachelors) {
    candidates.push({
      key: "bachelors",
      label: "Bachelors OK",
      filterValue: "bachelor",
      type: "lifestyle",
      className: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/30 font-semibold hover:bg-purple-500/20 hover:border-purple-500/50",
      priority: 6,
    });
  }

  // 9. East Facing / Vastu
  const facing = res.facing || meta.facing;
  if (facing && /east|north/i.test(facing)) {
    candidates.push({
      key: "facing",
      label: `${facing} Facing`,
      filterValue: `${facing} Facing`,
      type: "lifestyle",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-semibold hover:bg-amber-500/20 hover:border-amber-500/50",
      priority: 7,
    });
  }

  // 10. Gated Society / Security / CCTV
  const hasSecurity = amenitiesList.some((a) => /security|cctv/i.test(a));
  if (hasSecurity) {
    candidates.push({
      key: "security",
      label: "Gated / CCTV",
      filterValue: "security",
      type: "amenity",
      className: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/30 font-semibold hover:bg-slate-500/20 hover:border-slate-500/50",
      priority: 6,
    });
  }

  // 11. Family Preferred
  const prefersFamily = tenants.some((t) => /family/i.test(t));
  if (prefersFamily) {
    candidates.push({
      key: "family",
      label: "Family Preferred",
      filterValue: "family",
      type: "lifestyle",
      className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 font-semibold hover:bg-indigo-500/20 hover:border-indigo-500/50",
      priority: 6,
    });
  }

  // 12. Lift Available
  const hasLift = amenitiesList.some((a) => /lift|elevator/i.test(a));
  if (hasLift) {
    candidates.push({
      key: "lift",
      label: "Lift Available",
      filterValue: "lift",
      type: "amenity",
      className: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 font-semibold hover:bg-cyan-500/20 hover:border-cyan-500/50",
      priority: 7,
    });
  }

  // Sort by priority rank (lower number = higher priority)
  candidates.sort((a, b) => a.priority - b.priority);

  // Return top `max` (default 4) badges
  return candidates.slice(0, max);
}

// Extracts transit proximity expressions (e.g. "1.5 km from railway station", "500m from metro")
// from property title, caption, or locality.
export function extractTransitPill(post) {
  if (!post) return null;
  const text = `${post.title || ""} ${post.caption || ""} ${post.locality || ""}`;
  if (!text.trim()) return null;

  // 1. Explicit distance/time to transit, e.g. "500m from metro", "2 km from railway station", "10 mins to metro"
  const distMatch = text.match(
    /(\d+(?:\.\d+)?\s*(?:km|kms|m|meters?|mins?|minutes?)\s*(?:from|to|near|away from)?\s*(?:railway\s*station|railway|train\s*station|metro\s*station|metro|airport|bus\s*stand|bus\s*stop))/i
  );
  if (distMatch) {
    const raw = distMatch[0].trim();
    const isTrain = /railway|train/i.test(raw);
    const isMetro = /metro|subway/i.test(raw);
    const icon = isTrain ? "🚆" : isMetro ? "🚇" : "📍";
    return { key: "transit", label: `${icon} ${raw}` };
  }

  // 2. Proximity phrases like "near metro", "near railway station", "close to metro"
  const nearMatch = text.match(
    /(?:near|close to|opposite|walking distance to|adj to)\s+(?:the\s+)?(metro\s*station|metro|railway\s*station|railway|airport)/i
  );
  if (nearMatch) {
    const raw = nearMatch[0].trim();
    const isTrain = /railway|train/i.test(raw);
    const icon = isTrain ? "🚆" : "🚇";
    return { key: "transit", label: `${icon} ${raw}` };
  }

  return null;
}

// Non-clickable dynamic informational badges (Transit distance, Proximity, Floor, Sqft, Baths, Maintenance)
export function getPropertyInfoBadges(post, options = {}) {
  if (!post) return [];
  const meta = post.postMeta || {};
  const res = meta.residential || {};
  const land = meta.land || {};
  const isRequirement = String(post.postType || "").toUpperCase().startsWith("REQUIREMENT_");
  if (isRequirement) return [];

  const infoBadges = [];

  // 1. Proximity / User Distance (if provided from distancePill)
  if (options.distPill) {
    infoBadges.push({
      key: "dist",
      icon: "MapPin",
      label: options.distPill.label,
      className: options.distPill.className,
    });
  }

  // 2. Railway / Metro / Transit Proximity
  const transitPill = extractTransitPill(post);
  if (transitPill) {
    infoBadges.push({
      key: "transit",
      label: transitPill.label,
      className: "bg-blue-500/8 text-blue-700/85 dark:text-blue-300/85 border border-blue-500/20 text-[10.5px] font-medium",
    });
  }

  // 3. Floor Information
  const floor = res.floorNumber ?? meta.floorNumber;
  const total = res.totalFloors ?? meta.totalFloors;
  if (floor !== undefined && floor !== null && floor !== "") {
    const fNum = Number(floor);
    if (!Number.isNaN(fNum)) {
      let floorLabel = `Floor ${fNum}`;
      if (fNum === 0) floorLabel = "Ground Floor";
      else if (total && fNum === Number(total)) floorLabel = `Top Floor (${fNum}/${total})`;
      else if (total && Number(total) > 0) floorLabel = `Floor ${fNum} of ${total}`;

      infoBadges.push({
        key: "floor",
        label: floorLabel,
        className: "bg-base-200/50 text-base-content/65 border border-base-300/40 text-[10.5px] font-normal",
      });
    }
  }

  // 4. Area (sqft or land area)
  if (post.areaSqft && Number(post.areaSqft) > 0) {
    infoBadges.push({
      key: "sqft",
      label: `${Number(post.areaSqft).toLocaleString("en-IN")} sqft`,
      className: "bg-base-200/50 text-base-content/65 border border-base-300/40 text-[10.5px] font-normal",
    });
  } else if (land.landArea && Number(land.landArea) > 0) {
    infoBadges.push({
      key: "landArea",
      label: `${land.landArea} ${land.landAreaUnit || "Acre"}`.trim(),
      className: "bg-base-200/50 text-base-content/65 border border-base-300/40 text-[10.5px] font-normal",
    });
  }

  // 5. Bathrooms (if >= 1)
  if (post.bathrooms && Number(post.bathrooms) > 0) {
    infoBadges.push({
      key: "baths",
      label: `${post.bathrooms} Bath${Number(post.bathrooms) > 1 ? "s" : ""}`,
      className: "bg-base-200/50 text-base-content/65 border border-base-300/40 text-[10.5px] font-normal",
    });
  }

  // 6. Maintenance charges
  const maint = res.maintenanceCharges ?? meta.maintenanceCharges;
  if (maint && Number(maint) > 0) {
    infoBadges.push({
      key: "maint",
      label: `₹${Number(maint).toLocaleString("en-IN")}/mo maint.`,
      className: "bg-base-200/50 text-base-content/65 border border-base-300/40 text-[10.5px] font-normal",
    });
  }

  // Return up to 4 info badges
  return infoBadges.slice(0, 4);
}
