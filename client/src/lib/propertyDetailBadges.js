// Builds the small pill-shaped detail tags shown under a property post's
// price/title (bedrooms, bathrooms, area, role-specific extras). Shared by
// the marketplace feed and the profile page's Posts/Saved grids so both show
// the same real data — only pushes a tag when the underlying field actually
// exists, instead of always showing "0 Beds / 0 Baths / 0 sqft".
//
// activeRole is optional — pass it (from MarketplacePage's role switcher) to
// also include role-specific postMeta fields; omit it (as the profile page
// does, which has no concept of "viewing as a role") to get just the
// universal fields.
export function buildPropertyDetailBadges(post, activeRole) {
  const details = [];

  if (post.bedrooms) details.push({ label: `${post.bedrooms} BHK`, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.bathrooms) details.push({ label: `${post.bathrooms} Baths`, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.areaSqft) details.push({ label: `${Number(post.areaSqft)} sqft`, color: "bg-slate-100", textColor: "text-slate-700" });
  if (post.propertyType) details.push({ label: post.propertyType, color: "bg-slate-100", textColor: "text-slate-700" });

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
