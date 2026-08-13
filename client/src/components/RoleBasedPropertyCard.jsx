import { Heart, Bookmark, Eye, MessageCircle, Share2, MapPin, IndianRupee, Calendar, BadgeCheck, TrendingUp, Home, Users, Building2, Star, Send, Phone, User } from "lucide-react";

const ROLE_CARD_CONFIGS = {
  Tenant: {
    priorityFields: ["rent", "furnishing", "availability", "commute", "deposit"],
    highlights: ["moveInDate", "furnishing", "tenantPreferences"],
    hideFields: ["reraNumber", "investmentPotential"],
    accentColor: "emerald"
  },
  Buyer: {
    priorityFields: ["price", "area", "rera", "location", "appreciation"],
    highlights: ["pricePerSqft", "reraNumber", "possessionDate"],
    hideFields: ["monthlyRent", "leaseTerms"],
    accentColor: "blue"
  },
  Seller: {
    priorityFields: ["views", "inquiries", "price", "daysListed"],
    highlights: ["viewCount", "inquiryCount", "engagementScore"],
    hideFields: ["rentalYield"],
    accentColor: "violet"
  },
  Broker: {
    priorityFields: ["commission", "leadQuality", "price", "location"],
    highlights: ["leadScore", "commissionRate", "buyerUrgency"],
    hideFields: [],
    accentColor: "amber"
  },
  Builder: {
    priorityFields: ["projectStatus", "rera", "inventory", "launchDate"],
    highlights: ["reraNumber", "completionProgress", "unitAvailability"],
    hideFields: ["monthlyRent"],
    accentColor: "indigo"
  },
  Investor: {
    priorityFields: ["roi", "rentalYield", "appreciation", "location"],
    highlights: ["projectedROI", "rentalYield", "marketTrends"],
    hideFields: ["furnishing", "tenantPreferences"],
    accentColor: "rose"
  }
};

const ACCENT_COLORS = {
  emerald: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800" },
  blue: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200", badge: "bg-blue-100 text-blue-800" },
  violet: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", badge: "bg-violet-100 text-violet-800" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", badge: "bg-amber-100 text-amber-800" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200", badge: "bg-indigo-100 text-indigo-800" },
  rose: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", badge: "bg-rose-100 text-rose-800" }
};

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactNumber(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num === 0) return "0";
  if (num >= 10000000) return `${(num / 10000000).toFixed(1)}Cr`;
  if (num >= 100000) return `${(num / 100000).toFixed(1)}L`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function relativeDate(dateString) {
  if (!dateString) return "Just now";
  const time = new Date(dateString).getTime();
  if (!Number.isFinite(time)) return "Just now";
  const delta = Date.now() - time;
  const hours = Math.floor(delta / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function RoleBasedPropertyCard({ post, userRole, onLike, onSave, onShare, onView, onClick, onContact, isOwnPost, isFriend }) {
  const role = userRole || "Buyer";
  const config = ROLE_CARD_CONFIGS[role] || ROLE_CARD_CONFIGS.Buyer;
  const colors = ACCENT_COLORS[config.accentColor] || ACCENT_COLORS.blue;

  const isLiked = post.likedBy?.length > 0;
  const isSaved = post.savedBy?.length > 0;
  const postType = String(post.postType || "").toUpperCase();
  const isRequirement = postType.startsWith("REQUIREMENT_");
  const isProject = postType === "BUILDER_PROJECT";

  const price = isRequirement ? post.postMeta?.requirement?.budgetMax : post.price;
  const area = post.areaSqft || post.postMeta?.project?.totalArea || 0;
  const pricePerSqft = area > 0 && price > 0 ? Math.round(price / area) : 0;

  // Dynamic contact button text based on property type
  const getContactButtonText = () => {
    if (isOwnPost) return "Edit Post";
    
    const authorName = post.author?.fullName || post.author?.name || "Owner";
    const firstName = authorName.split(" ")[0];
    
    if (isFriend) return `Message ${firstName}`;
    return `Contact ${firstName}`;
  };

  const highlights = [];
  
  // Role-specific highlights
  if (role === "Tenant") {
    if (post.postMeta?.requirement?.furnishedPreference) {
      highlights.push({ icon: Home, label: post.postMeta.requirement.furnishedPreference });
    }
    if (post.postMeta?.requirement?.moveInDate) {
      highlights.push({ icon: Calendar, label: `Move-in: ${post.postMeta.requirement.moveInDate}` });
    }
    if (post.postMeta?.requirement?.depositAmount > 0) {
      highlights.push({ icon: IndianRupee, label: `Deposit: ${formatCompactNumber(post.postMeta.requirement.depositAmount)}` });
    }
  } else if (role === "Buyer") {
    if (pricePerSqft > 0) {
      highlights.push({ icon: TrendingUp, label: `${formatCompactNumber(pricePerSqft)}/sqft` });
    }
    if (post.postMeta?.project?.reraNumber) {
      highlights.push({ icon: BadgeCheck, label: "RERA Registered" });
    }
    if (post.postMeta?.project?.possessionDate) {
      highlights.push({ icon: Calendar, label: `Possession: ${post.postMeta.project.possessionDate}` });
    }
  } else if (role === "Seller") {
    highlights.push({ icon: Eye, label: `${formatCompactNumber(post.viewCount)} views` });
    if (post.engagementScore > 0) {
      highlights.push({ icon: Star, label: `Score: ${post.engagementScore}` });
    }
    highlights.push({ icon: Calendar, label: relativeDate(post.createdAt) });
  } else if (role === "Broker") {
    if (post.postMeta?.investment?.thesis) {
      highlights.push({ icon: TrendingUp, label: "High ROI Potential" });
    }
    highlights.push({ icon: Users, label: `${formatCompactNumber(post.chatCount)} inquiries` });
    if (post.author?.isVerified) {
      highlights.push({ icon: BadgeCheck, label: "Verified Seller" });
    }
  } else if (role === "Builder") {
    if (post.postMeta?.project?.reraNumber) {
      highlights.push({ icon: BadgeCheck, label: `RERA: ${post.postMeta.project.reraNumber}` });
    }
    if (post.postMeta?.project?.launchDate) {
      highlights.push({ icon: Calendar, label: `Launched: ${post.postMeta.project.launchDate}` });
    }
    highlights.push({ icon: Building2, label: isProject ? "New Project" : "Property" });
  } else if (role === "Investor") {
    if (pricePerSqft > 0) {
      highlights.push({ icon: TrendingUp, label: `${formatCompactNumber(pricePerSqft)}/sqft` });
    }
    if (area >= 2000) {
      highlights.push({ icon: Building2, label: "Premium Size" });
    }
    if (post.city) {
      highlights.push({ icon: MapPin, label: post.city });
    }
  }

  // Common highlights for all roles
  if (post.bedrooms > 0) {
    highlights.push({ icon: Home, label: `${post.bedrooms} BHK` });
  }
  if (area > 0) {
    highlights.push({ icon: Building2, label: `${formatCompactNumber(area)} sqft` });
  }

  return (
    <article
      className="group overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md"
      onClick={onClick}
    >
      {/* Image Section */}
      <div className="relative overflow-hidden">
        <img
          src={post.mediaUrls?.[0] || "https://placehold.co/600x400?text=Property"}
          alt={post.title || "Property"}
          className="h-48 w-full object-cover transition group-hover:scale-105"
          loading="lazy"
        />
        
        {/* Badge */}
        <div className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${colors.badge}`}>
          {isRequirement ? "Requirement" : isProject ? "Project" : post.listingType || "Listing"}
        </div>

        {/* Verified Badge */}
        {post.author?.isVerified && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-slate-700 backdrop-blur">
            <BadgeCheck className="size-3 text-emerald-600" />
            Verified
          </div>
        )}

        {/* Quick Actions */}
        <div className="absolute right-3 bottom-3 flex gap-2">
          <button
            type="button"
            className={`flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-600 backdrop-blur transition hover:bg-white hover:text-red-500 ${isLiked ? "text-red-500" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(post._id);
            }}
          >
            <Heart className={`size-4 ${isLiked ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            className={`flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-600 backdrop-blur transition hover:bg-white hover:text-indigo-500 ${isSaved ? "text-indigo-500" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onSave?.(post._id);
            }}
          >
            <Bookmark className={`size-4 ${isSaved ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-4">
        {/* Price */}
        <div className="mb-2">
          <span className="text-lg font-bold text-slate-800">
            {formatMoney(price)}
          </span>
          {post.postType === "PROPERTY_RENT" && (
            <span className="text-sm text-slate-500">/month</span>
          )}
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-sm font-semibold text-slate-800">
          {post.title || "Property Listing"}
        </h3>

        {/* Location */}
        {post.city && (
          <div className="mb-2 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="size-3" />
            <span className="line-clamp-1">{post.city}</span>
            {post.locality && <span>, {post.locality}</span>}
          </div>
        )}

        {/* Author with verified badge */}
        <div className="mb-3 flex items-center gap-2">
          <User className="size-3 text-slate-400" />
          <span className="text-xs font-medium text-slate-700">
            {post.author?.fullName || post.author?.name || "Unknown"}
          </span>
          {post.author?.isVerified && (
            <BadgeCheck className="size-3 text-emerald-600" />
          )}
        </div>

        {/* Role-Specific Highlights */}
        <div className="mb-3 flex flex-wrap gap-2">
          {highlights.slice(0, 4).map((highlight, index) => {
            const Icon = highlight.icon;
            return (
              <div
                key={index}
                className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${colors.badge}`}
              >
                <Icon className="size-3" />
                <span>{highlight.label}</span>
              </div>
            );
          })}
        </div>

        {/* Engagement Stats */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Eye className="size-3" />
              <span>{formatCompactNumber(post.viewCount)}</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="size-3" />
              <span>{formatCompactNumber(post.likedBy?.length || 0)}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="size-3" />
              <span>{formatCompactNumber(post.chatCount)}</span>
            </div>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-slate-400 transition hover:text-slate-600"
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(post._id);
            }}
          >
            <Share2 className="size-3" />
          </button>
        </div>

        {/* Dynamic Contact Button */}
        <div className="mt-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition flex items-center justify-center gap-2 ${
              isOwnPost
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onContact?.(post);
            }}
          >
            {isOwnPost ? (
              <Send className="size-4" />
            ) : (
              <MessageCircle className="size-4" />
            )}
            {getContactButtonText()}
          </button>
        </div>
      </div>
    </article>
  );
}
