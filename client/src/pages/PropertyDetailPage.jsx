import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bath,
  Bed,
  Bookmark,
  BookmarkCheck,
  Building2,
  Calendar,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  Expand,
  ExternalLink,
  FileText,
  Flag,
  Heart,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Share2,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ShareModal from "../components/ShareModal";
import ReportPostModal from "../components/ReportPostModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import axiosInstance from "../lib/axios";
import AppShell from "../components/AppShell";
import { addRecentlyViewed } from "../utils/recentlyViewed";

function normalizeMediaUrls(raw) {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw.split(",").map((item) => String(item || "").trim()).filter(Boolean);
  }
  return [];
}

function isVideoUrl(url) {
  if (!url) return false;
  const videoExtensions = [".mp4", ".webm", ".ogg", ".mov", ".avi"];
  return videoExtensions.some((ext) => url.toLowerCase().endsWith(ext));
}

function formatMoney(amount) {
  if (!amount && amount !== 0) return "Price on Request";
  const num = Number(amount);
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function relativeDate(dateString) {
  if (!dateString) return "Recently";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function formatDate(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getListingBadge(post) {
  if (post?.customBadge) return post.customBadge;
  const listingType = post?.listingType?.toLowerCase();
  if (listingType === "rent") return "For Rent";
  if (listingType === "lease") return "For Lease";
  if (listingType === "buy") return "Wanted";
  if (listingType) return titleCase(post.listingType);
  return "For Sale";
}

const AMENITY_TYPE_META = {
  schools: { emoji: "🏫", label: "Schools" },
  hospitals: { emoji: "🏥", label: "Hospitals" },
  metro: { emoji: "🚇", label: "Metro Stations" },
  malls: { emoji: "🏬", label: "Malls" },
};

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
      {title ? (
        <h2 className="text-xl font-semibold text-slate-900 mb-6 flex items-center gap-2">
          {Icon ? <Icon className="size-5 text-indigo-600" /> : null}
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}

function SpecCard({ icon: Icon, value, label, tone }) {
  return (
    <div className={`rounded-xl p-5 text-center transition-colors ${tone}`}>
      {Icon ? <Icon className="size-6 mx-auto mb-2" /> : null}
      <p className="text-sm font-bold text-slate-900 truncate">{value}</p>
      <p className="text-xs text-slate-600">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [expandedAbout, setExpandedAbout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify");
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  const authUser = authData?.data?.user || authData?.data || null;

  const { data: postData, isLoading } = useQuery({
    queryKey: ["propertyPost", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${id}`);
      return res.data?.data?.post;
    },
    enabled: !!id,
  });

  const latitude = postData?.latitude || postData?.postMeta?.latitude;
  const longitude = postData?.longitude || postData?.postMeta?.longitude;

  const { data: amenitiesResult, isLoading: amenitiesLoading, isError: amenitiesError } = useQuery({
    queryKey: ["nearbyAmenities", latitude, longitude],
    queryFn: async () => {
      const response = await axiosInstance.get(
        `/amenities/nearby?lat=${latitude}&lng=${longitude}&radius=2000&types=schools,hospitals,metro,malls`
      );
      return { items: response.data?.data || [], radius: response.data?.radius || 2000 };
    },
    enabled: Boolean(latitude && longitude),
    retry: 1,
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyPost", id] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
    },
  });

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyPost", id] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
    },
  });

  const { mutate: submitReport, isPending: isReportPending } = useMutation({
    mutationFn: async ({ reasonCode, description }) => {
      const response = await axiosInstance.post(`/posts/${id}/report`, { reasonCode, description });
      return response.data;
    },
    onSuccess: () => {
      setReportSubmitted(true);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit report");
    },
  });

  // Increment view count when page loads
  useEffect(() => {
    if (id) {
      axiosInstance.post(`/posts/${id}/view`).catch(() => {
        // Non-critical — view count is best-effort.
      });
    }
  }, [id]);

  // Track for the "Recently Viewed" rail once the post's data has actually
  // loaded (need title/image/price to display it later, not just the id).
  useEffect(() => {
    if (postData) addRecentlyViewed(postData);
  }, [postData]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </AppShell>
    );
  }

  if (!postData) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-slate-500">Property not found</p>
        </div>
      </AppShell>
    );
  }

  const media = normalizeMediaUrls(postData.mediaUrls);
  const currentImage = media[carouselIndex] || media[0];
  const isVideo = isVideoUrl(currentImage);
  const description = postData.caption || "";
  const shouldShowReadMore = description.length > 200;

  const isOwner = authUser?._id && postData.author?._id && String(authUser._id) === String(postData.author._id);

  // The live creation flow (MarketplacePage) writes postMeta.requirement/project/investment,
  // but older data (and some other views like the compare tool) used flat postMeta.* keys.
  // Read both so real data shows up regardless of which shape a given post was saved with.
  const flatMeta = postData.postMeta && typeof postData.postMeta === "object" && !Array.isArray(postData.postMeta) ? postData.postMeta : {};
  const requirement = flatMeta.requirement || {};
  const project = flatMeta.project || {};
  const investment = flatMeta.investment || {};

  const furnishing = requirement.furnishedPreference || flatMeta.furnishing || "";
  const hasParking = requirement.parkingRequired || flatMeta.parking;
  const possession = flatMeta.possessionStatus || (requirement.possessionDate ? formatDate(requirement.possessionDate) : "");
  const facing = flatMeta.facing || "";
  const floorNumber = flatMeta.floorNumber;
  const totalFloors = flatMeta.totalFloors;
  const ageOfProperty = flatMeta.ageOfProperty || "";

  const amenitiesList = Array.isArray(flatMeta.amenities) && flatMeta.amenities.length > 0
    ? flatMeta.amenities
    : String(requirement.amenitiesText || "").split(",").map((item) => item.trim()).filter(Boolean);

  const hasRequirementData = Boolean(
    requirement.moveInDate || requirement.availableFromDate || requirement.leaseDurationMonths ||
    requirement.budgetMin || requirement.budgetMax || requirement.occupancyPreference ||
    requirement.genderPreference || requirement.requirementPropertyType || requirement.depositAmount ||
    requirement.tenantType || requirement.occupation || requirement.loanRequired
  );
  const hasProjectData = Boolean(project.projectName || project.launchDate || project.reraNumber || project.brochureUrl);
  const hasInvestmentData = Boolean(investment.thesis);

  const reraNumber = project.reraNumber || flatMeta.reraNumber || "";
  const reraVerified = Boolean(flatMeta.reraVerified);
  const projectStatus = flatMeta.projectStatus || "";
  const maintenanceCharges = flatMeta.maintenanceCharges;
  const bookingAmount = flatMeta.bookingAmount;

  const specs = [
    postData.bedrooms ? { icon: Bed, value: postData.bedrooms, label: "Bedrooms", tone: "bg-indigo-50 text-indigo-600" } : null,
    postData.bathrooms ? { icon: Bath, value: postData.bathrooms, label: "Bathrooms", tone: "bg-blue-50 text-blue-600" } : null,
    postData.areaSqft ? { icon: Ruler, value: `${Number(postData.areaSqft).toLocaleString("en-IN")} sq.ft`, label: "Area", tone: "bg-emerald-50 text-emerald-600" } : null,
    postData.propertyType ? { icon: Building2, value: postData.propertyType, label: "Type", tone: "bg-amber-50 text-amber-600" } : null,
    furnishing ? { icon: Home, value: titleCase(furnishing), label: "Furnishing", tone: "bg-purple-50 text-purple-600" } : null,
    hasParking ? { icon: Car, value: "Available", label: "Parking", tone: "bg-green-50 text-green-600" } : null,
    possession ? { icon: Clock, value: possession, label: "Possession", tone: "bg-rose-50 text-rose-600" } : null,
    facing ? { icon: Compass, value: facing, label: "Facing", tone: "bg-slate-100 text-slate-600" } : null,
    floorNumber ? { icon: Layers, value: totalFloors ? `${floorNumber} of ${totalFloors}` : `Floor ${floorNumber}`, label: "Floor", tone: "bg-cyan-50 text-cyan-600" } : null,
    ageOfProperty ? { icon: Calendar, value: ageOfProperty, label: "Age", tone: "bg-orange-50 text-orange-600" } : null,
  ].filter(Boolean);

  const amenitiesData = amenitiesResult?.items || [];
  const amenitiesRadiusKm = ((amenitiesResult?.radius || 2000) / 1000).toFixed(amenitiesResult?.radius % 1000 ? 1 : 0);

  const publishedDiffersFromCreated = postData.publishedAt && postData.createdAt &&
    new Date(postData.publishedAt).getTime() !== new Date(postData.createdAt).getTime();
  const wasEdited = postData.updatedAt && postData.createdAt &&
    new Date(postData.updatedAt).getTime() - new Date(postData.createdAt).getTime() > 60000;

  return (
    <AppShell hideHero>
      <div className="min-h-screen bg-slate-50">
        {/* Fullscreen Image Modal */}
        {isFullscreen && (
          <div
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
          >
            <img src={currentImage} alt="Fullscreen view" className="max-w-full max-h-full object-contain" />
            <button
              className="absolute top-4 right-4 size-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-all"
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
            >
              <X className="size-6" />
            </button>
          </div>
        )}

        {/* Hero Image Section */}
        <div className="relative group w-full aspect-video bg-slate-100">
          {media.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <Home className="size-16" />
            </div>
          ) : isVideo ? (
            <video src={currentImage} className="w-full h-full object-cover" controls />
          ) : (
            <img src={currentImage} alt={postData.title || "Property"} className="w-full h-full object-cover" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none">
            <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
              {media.length > 0 && (
                <span className="rounded-full bg-black/55 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
                  {carouselIndex + 1}/{media.length}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  postData.customBadge ? getCustomBadgeClasses(postData.customBadge) : "bg-indigo-600 text-white"
                }`}
              >
                {getListingBadge(postData)}
              </span>
            </div>

            <div className="absolute bottom-4 right-4 flex items-center gap-2 pointer-events-auto">
              {media.length > 0 && (
                <button
                  className="size-10 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75 transition-opacity"
                  onClick={() => setIsFullscreen(true)}
                >
                  <Expand className="size-5" />
                </button>
              )}
              <button
                className="size-10 rounded-full flex items-center justify-center text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75 transition-opacity"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 className="size-5" />
              </button>
              <button
                className={`size-10 rounded-full flex items-center justify-center transition-colors ${postData.isSavedByMe ? 'bg-indigo-600 text-white' : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75'}`}
                onClick={() => toggleSave(postData._id)}
              >
                {postData.isSavedByMe ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
              </button>
            </div>
          </div>

          {media.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                onClick={() => setCarouselIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1))}
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 size-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-all opacity-0 group-hover:opacity-100"
                onClick={() => setCarouselIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1))}
              >
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
        </div>

        {/* Thumbnail Gallery */}
        {media.length > 1 && (
          <div className="bg-white border-b border-slate-200 py-3 px-4 overflow-x-auto">
            <div className="flex gap-2">
              {media.map((img, idx) => (
                <button
                  key={idx}
                  className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === carouselIndex ? 'border-indigo-600' : 'border-transparent hover:border-slate-300'
                  }`}
                  onClick={() => setCarouselIndex(idx)}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-[1400px] mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-3 space-y-6">
              {/* Core Information */}
              <Section>
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[240px]">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h1 className="text-3xl md:text-4xl font-bold text-slate-900">{postData.title || "Property Listing"}</h1>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${postData.status === "PUBLISHED" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                        {titleCase(postData.status) || "Active"}
                      </span>
                      {postData.visibility === "PRIVATE" && (
                        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">Private</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-600 flex-wrap">
                      <MapPin className="size-5 text-indigo-600" />
                      <span className="text-lg">
                        {[postData.locality, postData.city].filter(Boolean).join(", ") || "Location not specified"}
                      </span>
                      {latitude && longitude && (
                        <span className="flex items-center gap-1 text-indigo-600 text-sm">
                          <span className="size-2 rounded-full bg-indigo-600"></span>
                          <span>Live Location</span>
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {titleCase(postData.postType)}
                      </span>
                      {isOwner && (
                        <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                          Your listing
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl md:text-4xl font-bold text-indigo-600">{formatMoney(postData.price)}</p>
                    <p className="text-sm text-slate-500 mt-1">Posted {relativeDate(postData.createdAt)}</p>
                    {wasEdited && <p className="text-xs text-slate-400">Edited {relativeDate(postData.updatedAt)}</p>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-6">
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      postData.isLikedByMe ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    onClick={() => toggleLike(postData._id)}
                  >
                    <Heart className={`size-4 ${postData.isLikedByMe ? 'fill-current' : ''}`} />
                    {postData.likesCount || 0} Likes
                  </button>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                    <MessageCircle className="size-4" />
                    {postData.commentCount || 0} Comments
                  </span>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                    <Eye className="size-4" />
                    {postData.viewCount || 0} Views
                  </span>
                  {postData.shareCount > 0 && (
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                      <Share2 className="size-4" />
                      {postData.shareCount} Shares
                    </span>
                  )}
                  {postData.savesCount > 0 && (
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                      <Bookmark className="size-4" />
                      {postData.savesCount} Saves
                    </span>
                  )}
                </div>

                {description && (
                  <div className="mt-6">
                    <p className={`text-slate-600 leading-relaxed text-lg ${!expandedAbout && shouldShowReadMore ? 'line-clamp-3' : ''}`}>
                      {description}
                    </p>
                    {shouldShowReadMore && (
                      <button
                        onClick={() => setExpandedAbout(!expandedAbout)}
                        className="text-indigo-600 font-medium hover:text-indigo-700 text-sm mt-2"
                      >
                        {expandedAbout ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}
              </Section>

              {/* Specifications */}
              {specs.length > 0 && (
                <Section title="Property Specifications">
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {specs.map((spec, idx) => (
                      <SpecCard key={idx} icon={spec.icon} value={spec.value} label={spec.label} tone={spec.tone} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Amenities (features listed by the poster) */}
              {amenitiesList.length > 0 && (
                <Section title="Amenities">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {amenitiesList.map((amenity, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 hover:bg-slate-100 px-4 py-3 rounded-xl text-sm text-slate-700 transition-colors">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0"></span>
                        {amenity}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Requirement details — for REQUIREMENT_BUY / REQUIREMENT_RENT posts */}
              {hasRequirementData && (
                <Section title="Requirement Details" icon={FileText}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Budget range" value={
                      (requirement.budgetMin || requirement.budgetMax)
                        ? `${formatMoney(requirement.budgetMin)} – ${formatMoney(requirement.budgetMax)}`
                        : null
                    } />
                    <InfoRow label="Requirement type" value={requirement.requirementPropertyType} />
                    <InfoRow label="Occupancy preference" value={requirement.occupancyPreference} />
                    <InfoRow label="Gender preference" value={requirement.genderPreference} />
                    <InfoRow label="Tenant type" value={requirement.tenantType} />
                    <InfoRow label="Occupation" value={requirement.occupation} />
                    <InfoRow label="Move-in date" value={formatDate(requirement.moveInDate)} />
                    <InfoRow label="Available from" value={formatDate(requirement.availableFromDate)} />
                    <InfoRow label="Lease duration" value={requirement.leaseDurationMonths ? `${requirement.leaseDurationMonths} months` : null} />
                    <InfoRow label="Deposit amount" value={requirement.depositAmount ? formatMoney(requirement.depositAmount) : null} />
                    <InfoRow label="Loan required" value={requirement.loanRequired ? "Yes" : null} />
                  </div>
                </Section>
              )}

              {/* Project details — for BUILDER_PROJECT posts */}
              {hasProjectData && (
                <Section title="Project Details" icon={Building2}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Project name" value={project.projectName} />
                    <InfoRow label="Launch date" value={formatDate(project.launchDate)} />
                    <InfoRow label="RERA number" value={project.reraNumber} />
                  </div>
                  {project.brochureUrl && (
                    <a
                      href={project.brochureUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium text-sm"
                    >
                      <ExternalLink className="size-4" />
                      View project brochure
                    </a>
                  )}
                </Section>
              )}

              {/* Investment thesis — for INVESTMENT_OPPORTUNITY posts */}
              {hasInvestmentData && (
                <Section title="Investment Thesis" icon={TrendingUp}>
                  <p className="text-slate-600 leading-relaxed">{investment.thesis}</p>
                </Section>
              )}

              {/* Financial Details */}
              {(postData.price || maintenanceCharges || bookingAmount) && (
                <Section title="Financial Details" icon={Wallet}>
                  <div className="space-y-1">
                    <InfoRow label="Price" value={<span className="text-xl font-bold">{formatMoney(postData.price)}</span>} />
                    <InfoRow label="Maintenance charges" value={maintenanceCharges ? `₹${Number(maintenanceCharges).toLocaleString("en-IN")}/month` : null} />
                    <InfoRow label="Booking amount" value={bookingAmount ? formatMoney(bookingAmount) : null} />
                  </div>
                </Section>
              )}

              {/* Location Section */}
              {latitude && longitude && (
                <Section title="Location & Neighborhood" icon={MapPin}>
                  <div className="h-80 rounded-xl overflow-hidden bg-slate-100 mb-6">
                    <iframe
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight="0"
                      marginWidth="0"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`}
                      title="Property Location"
                    />
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Nearby Amenities</h3>
                  {amenitiesLoading && (
                    <p className="text-sm text-slate-500">Loading nearby amenities...</p>
                  )}
                  {!amenitiesLoading && amenitiesError && (
                    <p className="text-sm text-red-500">Couldn't load nearby amenities. Try again in a moment.</p>
                  )}
                  {!amenitiesLoading && !amenitiesError && amenitiesData.length === 0 && (
                    <p className="text-sm text-slate-400">No amenities found within {amenitiesRadiusKm}km.</p>
                  )}
                  {!amenitiesLoading && !amenitiesError && amenitiesData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {amenitiesData.slice(0, 8).map((amenity) => (
                        <div key={amenity.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <span className="text-lg">{AMENITY_TYPE_META[amenity.type]?.emoji || "📍"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-slate-900 truncate">{amenity.name}</p>
                            <p className="text-xs text-slate-500">
                              {AMENITY_TYPE_META[amenity.type]?.label || "Nearby"} · {amenity.distance}m away
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* Legal & Ownership Information */}
              {(reraVerified || reraNumber || possession || projectStatus) && (
                <Section title="Legal & Ownership Details" icon={ShieldCheck}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {reraVerified && (
                      <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-xl">
                        <span className="text-slate-600">RERA Verified</span>
                        <span className="font-bold text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full text-sm">✓ Verified</span>
                      </div>
                    )}
                    <InfoRow label="RERA Number" value={reraNumber} />
                    <InfoRow label="Possession Status" value={possession} />
                    <InfoRow label="Project Status" value={projectStatus} />
                  </div>
                </Section>
              )}

              {/* Post Information */}
              <Section title="Post Information">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Posted</p>
                    <p className="font-medium text-slate-900">{formatDate(postData.createdAt)}</p>
                  </div>
                  {publishedDiffersFromCreated && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="text-xs text-slate-500 mb-1">Published</p>
                      <p className="font-medium text-slate-900">{formatDate(postData.publishedAt)}</p>
                    </div>
                  )}
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Post Type</p>
                    <p className="font-medium text-slate-900">{titleCase(postData.postType) || "Property"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Listing Type</p>
                    <p className="font-medium text-slate-900">{postData.listingType || "Sale"}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="text-xs text-slate-500 mb-1">Visibility</p>
                    <p className="font-medium text-slate-900">{titleCase(postData.visibility) || "Public"}</p>
                  </div>
                </div>
              </Section>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Seller Profile Card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                  <Link to={`/users/${postData.author?._id}`} className="flex items-center gap-4 mb-6 group">
                    <div className="size-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
                      <div className="size-full rounded-full bg-white p-0.5">
                        {postData.author?.profilePic ? (
                          <img src={postData.author.profilePic} alt={postData.author.fullName} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-slate-100 rounded-full">
                            <span className="text-2xl font-bold text-slate-600">{postData.author?.fullName?.charAt(0) || "U"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                          {postData.author?.fullName || "Unknown"}
                        </p>
                        {postData.author?.isVerified && (
                          <BadgeCheck className="size-5 text-indigo-600 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        {titleCase(postData.author?.activeRole || postData.author?.primaryRole || postData.authorRole) || "Property Owner"}
                      </p>
                      {postData.author?.city && (
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin className="size-3" />
                          {postData.author.city}
                        </p>
                      )}
                    </div>
                  </Link>

                  <div className="space-y-3">
                    {postData.author?.mobileNumber && (
                      <>
                        <a
                          href={`tel:${postData.author.mobileNumber}`}
                          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Phone className="size-5" />
                          {postData.author.mobileNumber}
                        </a>
                        <a
                          href={`https://wa.me/${postData.author.mobileNumber.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="size-5" />
                          WhatsApp
                        </a>
                      </>
                    )}
                    <Link
                      to={`/marketplace?section=chat&userId=${postData.author?._id}`}
                      className="w-full py-3 px-4 bg-white border-2 border-indigo-600 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="size-5" />
                      Chat
                    </Link>
                    <Link
                      to={`/users/${postData.author?._id}`}
                      className="w-full py-3 px-4 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Users className="size-5" />
                      View Profile
                    </Link>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-3">
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                      postData.isLikedByMe
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => toggleLike(postData._id)}
                  >
                    <Heart className={`size-5 ${postData.isLikedByMe ? 'fill-current' : ''}`} />
                    {postData.isLikedByMe ? 'Liked' : 'Like'}
                  </button>
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                      postData.isSavedByMe
                        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                        : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => toggleSave(postData._id)}
                  >
                    {postData.isSavedByMe ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
                    {postData.isSavedByMe ? 'Saved' : 'Save'}
                  </button>
                  <button
                    className="w-full py-3 px-4 bg-white text-slate-700 border border-slate-200 font-semibold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setShowShareModal(true)}
                  >
                    <Share2 className="size-5" />
                    Share
                  </button>
                  {!isOwner && (
                    <button
                      className="w-full py-3 px-4 bg-white text-red-600 border border-slate-200 font-semibold rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                      onClick={() => setShowReportModal(true)}
                    >
                      <Flag className="size-5" />
                      Report
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        postUrl={postData ? `${window.location.origin}/property/${postData._id}` : ""}
        postTitle={postData?.title || "Property"}
        postId={postData?._id}
        postImage={media[0] || ""}
      />

      <ReportPostModal
        isOpen={showReportModal}
        isPending={isReportPending}
        isSubmitted={reportSubmitted}
        onCancel={() => setShowReportModal(false)}
        onConfirm={(payload) => submitReport(payload)}
        onDone={() => {
          setShowReportModal(false);
          setReportSubmitted(false);
        }}
      />
    </AppShell>
  );
}
