import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  AlertTriangle,
  ArrowUpDown,
  Ban,
  Bath,
  Bed,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Droplets,
  Dumbbell,
  Eye,
  Expand,
  ExternalLink,
  FileText,
  Flag,
  Flame,
  GraduationCap,
  Handshake,
  Heart,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Phone,
  Ruler,
  Share2,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  BarChart3,
  TrendingUp,
  User,
  UserRoundPlus,
  Users,
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Wallet,
  Wifi,
  Wind,
  X,
  Zap,
} from "lucide-react";
import toast from "react-hot-toast";
import BoostPropertyModal from "../components/BoostPropertyModal";
import VerifyAddressModal from "../components/VerifyAddressModal";
import { getPostSpaceType, extractTransitPill } from "../lib/propertyDetailBadges";
import ShareModal from "../components/ShareModal";
import NeighbourhoodSummary from "../components/NeighbourhoodSummary";
import NeighbourhoodSafetyCard from "../components/NeighbourhoodSafetyCard";
import AiValuationCard from "../components/AiValuationCard";
import { useFeatureFlag } from "../context/FeatureFlagContext";
import AmenitiesModal from "../components/AmenitiesModal";
import PriceAlertButton from "../components/PriceAlertButton";
import ReportPostModal from "../components/ReportPostModal";
import OfferModal from "../components/OfferModal";
import VisitScheduler from "../components/VisitScheduler";
import OfferHistoryTimeline from "../components/OfferHistoryTimeline";
import PriceHistoryChart from "../components/PriceHistoryChart";
import LocalityInsightsCard from "../components/LocalityInsightsCard";
import ListingPerformance from "../components/ListingPerformance";
import TransactionTracker from "../components/TransactionTracker";
import ReviewModal from "../components/ReviewModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import SEO from "../components/SEO";
import { getSellerTrustSignals } from "../lib/trustSignals";
import { getPropertySignals, toneClass } from "../lib/propertySignalBadges";
import SimilarProperties from "../components/SimilarProperties";
import axiosInstance from "../lib/axios";
import AppShell from "../components/AppShell";
import { addRecentlyViewed } from "../utils/recentlyViewed";
import { notePropertyView } from "../hooks/usePreferencePrompt";
import { useRequestBooking, useBookingStatus, useCancelBooking } from "../hooks/usePgResidency";

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

const AMENITY_ICONS = {
  "attached washroom": Bath,
  "unattached washroom": Bath,
  "washroom": Bath,
  "bed": Bed,
  "mattress": Bed,
  "geyser": Flame,
  "water purifier": Droplets,
  "24x7 water supply": Droplets,
  "water supply": Droplets,
  "ac": Wind,
  "air conditioner": Wind,
  "security/cctv": ShieldCheck,
  "cctv": ShieldCheck,
  "security": ShieldCheck,
  "fan & lights": Zap,
  "fan": Zap,
  "lights": Zap,
  "wifi": Wifi,
  "covered parking": Car,
  "open parking": Car,
  "parking": Car,
  "laundry": Shirt,
  "wardrobe": Layers,
  "modular kitchen": UtensilsCrossed,
  "kitchen": UtensilsCrossed,
  "gas stove/chimney": Flame,
  "gas stove": Flame,
  "chimney": Flame,
  "lift": ArrowUpDown,
  "gym": Dumbbell,
};

function getAmenityIcon(name) {
  const normalized = String(name || "").toLowerCase().trim();
  for (const [key, IconComp] of Object.entries(AMENITY_ICONS)) {
    if (normalized.includes(key)) return IconComp;
  }
  return Sparkles;
}

const TENANT_ICONS = {
  "male": User,
  "female": User,
  "bachelor": User,
  "bachelors": Users,
  "working": Briefcase,
  "professional": Briefcase,
  "student": GraduationCap,
  "students": GraduationCap,
  "family": Home,
  "any": Users,
};

function getTenantIcon(name) {
  const normalized = String(name || "").toLowerCase().trim();
  for (const [key, IconComp] of Object.entries(TENANT_ICONS)) {
    if (normalized.includes(key)) return IconComp;
  }
  return Users;
}

function getListingBadge(post) {
  // Takes priority over customBadge — once a deal is closed, that's more
  // important and more accurate than whatever badge text was set while the
  // listing was still active.
  if (post?.offerStatus === "ACCEPTED") {
    const listingType = post?.listingType?.toLowerCase();
    return listingType === "rent" || listingType === "lease" ? "Rented" : "Sold";
  }
  if (post?.customBadge) return post.customBadge;
  const postType = String(post?.postType || "").toUpperCase();
  if (postType === "AGRICULTURAL_LISTING") {
    return post?.listingType?.toLowerCase() === "rent" ? "Land for Lease" : "Land for Sale";
  }
  const listingType = post?.listingType?.toLowerCase();
  if (listingType === "rent") return "For Rent";
  if (listingType === "lease") return "For Lease";
  if (listingType === "buy") return "Wanted";
  if (listingType === "sell") return "For Sale";
  if (listingType) return titleCase(post.listingType);
  return "For Sale";
}

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-4 sm:p-6 md:p-8">
      {title ? (
        <h2 className="text-xl font-semibold text-base-content mb-6 flex items-center gap-2">
          {Icon ? <Icon className="size-5 text-primary" /> : null}
          {title}
        </h2>
      ) : null}
      {children}
    </div>
  );
}

function SpecCard({ icon: Icon, value, label }) {
  return (
    <div className="group flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-base-300/80 bg-base-200/50 p-2.5 sm:p-3 transition-all hover:border-primary/40 hover:bg-base-200 hover:shadow-xs min-w-0">
      <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        {Icon ? <Icon className="size-4 sm:size-4.5" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] font-semibold text-base-content/60 uppercase tracking-wider leading-tight">
          {label}
        </p>
        <p className="text-xs sm:text-sm font-bold text-base-content leading-snug break-words mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex items-center justify-between p-4 bg-base-200 rounded-xl">
      <span className="text-base-content/70">{label}</span>
      <span className="font-medium text-base-content text-right">{value}</span>
    </div>
  );
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [expandedAbout, setExpandedAbout] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHeroVideoMuted, setIsHeroVideoMuted] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAmenitiesModal, setShowAmenitiesModal] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [offerModal, setOfferModal] = useState(null); // { mode: "offer" | "counter", offerId? }
  const [reviewModal, setReviewModal] = useState(null); // { offerId, revieweeName }
  const [reviewedOfferIds, setReviewedOfferIds] = useState([]);
  const [showAllOffers, setShowAllOffers] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showPgBookingModal, setShowPgBookingModal] = useState(false);

  const isAiValuationEnabled = useFeatureFlag("ai_property_valuation");

  const { data: authData } = useAuthUser();
  const authUser = authData?.data?.user || authData?.data || null;

  // Short polling so a price change, offer, or accept from the other side
  // of a negotiation shows up without a manual reload — scoped to just this
  // page (pauses automatically while the tab is in the background).
  const { data: postData, isLoading } = useQuery({
    queryKey: ["propertyPost", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${id}`);
      return res.data?.data?.post;
    },
    enabled: !!id,
    refetchInterval: 15000,
  });

  const sellerId = postData?.author?._id;
  const isOwnerOfPost = Boolean(authUser?._id && sellerId && String(authUser._id) === String(sellerId));

  // Same source the general Profile page uses for its Connect/Message
  // button — the property page's "Chat" needs to gate on the same
  // friendship state, not offer a shortcut around it.
  const { data: sellerRelationship } = useQuery({
    queryKey: ["userRelationship", sellerId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/users/${sellerId}/profile`);
      return res.data?.data?.relationship || { connectionStatus: "none" };
    },
    enabled: Boolean(sellerId && authUser?._id && !isOwnerOfPost),
  });
  const connectionStatus = sellerRelationship?.connectionStatus || "none";

  const { mutate: sendConnectionRequest, isPending: isConnecting } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post(`/users/connection-request/${sellerId}`);
      return response.data;
    },
    onSuccess: () => {
      toast.success("Connection request sent");
      queryClient.invalidateQueries({ queryKey: ["userRelationship", sellerId] });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Could not send connection request");
    },
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

  const isRequirementPost = String(postData?.postType || "").toUpperCase().startsWith("REQUIREMENT_");
  const { data: priceInsight } = useQuery({
    queryKey: ["priceInsight", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${id}/price-insight`, { skipErrorToast: true });
      return res.data?.data?.insight || null;
    },
    enabled: Boolean(id && postData && !isRequirementPost && postData.price > 0),
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyPost", id] });
      const previousPost = queryClient.getQueryData(["propertyPost", id]);

      queryClient.setQueryData(["propertyPost", id], (old) => {
        if (!old || old._id !== postId) return old;
        const newSavedState = !old.isSavedByMe;
        return {
          ...old,
          isSavedByMe: newSavedState,
          savesCount: newSavedState ? (old.savesCount || 0) + 1 : Math.max(0, (old.savesCount || 0) - 1),
        };
      });

      return { previousPost };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["propertyPost", id], (old) => {
        if (!old) return old;
        return { ...old, isSavedByMe: data.saved, savesCount: data.savesCount };
      });
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyPost", id], context.previousPost);
    },
  });

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyPost", id] });
      const previousPost = queryClient.getQueryData(["propertyPost", id]);

      queryClient.setQueryData(["propertyPost", id], (old) => {
        if (!old || old._id !== postId) return old;
        const newLikedState = !old.isLikedByMe;
        return {
          ...old,
          isLikedByMe: newLikedState,
          likesCount: newLikedState ? (old.likesCount || 0) + 1 : Math.max(0, (old.likesCount || 0) - 1),
        };
      });

      return { previousPost };
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["propertyPost", id], (old) => {
        if (!old) return old;
        return { ...old, isLikedByMe: data.liked, likesCount: data.likesCount };
      });
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyPost", id], context.previousPost);
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

  const isOwnerForQueries = Boolean(
    authUser?._id && postData?.author?._id && String(authUser._id) === String(postData.author._id)
  );

  // Buyer's own offer thread on this post, if any.
  const { data: myOffer } = useQuery({
    queryKey: ["myOffer", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/offers/posts/${id}/offers/mine`);
      return res.data?.data?.offer || null;
    },
    enabled: Boolean(id && authUser?._id && postData && !isOwnerForQueries),
    refetchInterval: 15000,
  });

  const pgPostType = String(postData?.postType || "").toUpperCase();
  const { data: myBooking } = useBookingStatus(
    pgPostType === "PG_HOSTEL" && !isOwnerForQueries ? id : null,
    { enabled: Boolean(id && authUser?._id && pgPostType === "PG_HOSTEL" && !isOwnerForQueries) }
  );
  const { mutate: cancelBooking, isPending: isCancelling } = useCancelBooking();

  // Owner's incoming offers on this post.
  const { data: postOffers = [] } = useQuery({
    queryKey: ["postOffers", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/offers/posts/${id}/offers`);
      return res.data?.data?.offers || [];
    },
    enabled: Boolean(id && isOwnerForQueries),
    refetchInterval: 15000,
  });

  // The closing tracker — exists once an offer on this post has been accepted.
  const { data: deal } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/deals/post/${id}`, { skipErrorToast: true });
      return res.data?.data?.deal || null;
    },
    // Ask the server directly rather than gating on postData.offerStatus —
    // that flag is stale in a cached postData, and it's reset to OPEN when a
    // deal is cancelled (which would then hide a deal the user should still
    // see). The endpoint returns { deal: null } cheaply when there's none.
    enabled: Boolean(id && authUser?._id),
    retry: false,
    // Poll only while the deal is still live, so the other party's
    // confirmations show up without a manual refresh. A completed/cancelled
    // deal never changes — stop polling it entirely. Interval is generous
    // (12s) since deal steps aren't second-sensitive like a chat.
    refetchInterval: (query) => (query.state.data?.status === "ACTIVE" ? 12000 : false),
  });

  const invalidateOfferQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["myOffer", id] });
    queryClient.invalidateQueries({ queryKey: ["postOffers", id] });
    queryClient.invalidateQueries({ queryKey: ["deal", id] });
  };

  const { mutate: submitOffer, isPending: isOfferPending } = useMutation({
    mutationFn: async ({ price, message }) => {
      const response = await axiosInstance.post(`/offers/posts/${id}/offers`, { price, message, requestId: crypto.randomUUID() });
      return response.data;
    },
    onSuccess: () => {
      toast.success("Offer sent!");
      setOfferModal(null);
      invalidateOfferQueries();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to send offer");
    },
  });

  const { mutate: respondToOffer, isPending: isRespondPending } = useMutation({
    mutationFn: async ({ offerId, action, price, message }) => {
      const response = await axiosInstance.patch(`/offers/${offerId}`, { action, price, message, requestId: crypto.randomUUID() });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      const labels = { accept: "Offer accepted!", counter: "Counter-offer sent", decline: "Offer declined" };
      toast.success(labels[variables.action] || "Done");
      setOfferModal(null);
      invalidateOfferQueries();
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to respond to offer");
    },
  });

  const { mutate: submitReview, isPending: isReviewPending } = useMutation({
    mutationFn: async ({ offerId, rating, comment }) => {
      const response = await axiosInstance.post(`/reviews/offers/${offerId}/reviews`, { rating, comment });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      toast.success("Review submitted — thanks!");
      setReviewedOfferIds((prev) => [...prev, variables.offerId]);
      setReviewModal(null);
    },
    onError: (error, variables) => {
      if (error?.response?.status === 409) {
        setReviewedOfferIds((prev) => [...prev, variables.offerId]);
        setReviewModal(null);
        return;
      }
      toast.error(error?.response?.data?.message || "Failed to submit review");
    },
  });

  // Increment view count when page loads
  useEffect(() => {
    if (id) {
      axiosInstance
        .post(`/posts/${id}/view`)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
        })
        .catch(() => {
          // Non-critical — view count is best-effort.
        });
      notePropertyView(); // feeds the progressive-onboarding "shown enough listings" gate
    }
  }, [id, queryClient]);

  // Track for the "Recently Viewed" rail once the post's data has actually
  // loaded (need title/image/price to display it later, not just the id).
  useEffect(() => {
    if (postData) addRecentlyViewed(postData);
  }, [postData]);

  if (isLoading) {
    return (
      <AppShell showBackButton title="Property Details">
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="loading loading-spinner loading-lg"></div>
        </div>
      </AppShell>
    );
  }

  if (!postData) {
    return (
      <AppShell showBackButton title="Property Details">
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-base-content/60">Property not found</p>
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
  const residential = flatMeta.residential || {};
  const requirement = flatMeta.requirement || {};
  const project = flatMeta.project || {};
  const investment = flatMeta.investment || {};

  const furnishing = residential.furnishing || requirement.furnishedPreference || flatMeta.furnishing || "";
  const hasParking = requirement.parkingRequired || flatMeta.parking;
  const possession = flatMeta.possessionStatus || (requirement.possessionDate ? formatDate(requirement.possessionDate) : "");
  const facing = residential.facing || flatMeta.facing || "";
  const floorNumber = residential.floorNumber ?? flatMeta.floorNumber;
  const totalFloors = residential.totalFloors ?? flatMeta.totalFloors;
  const ageOfProperty = residential.ageOfProperty || flatMeta.ageOfProperty || "";
  const maintenanceCharges = residential.maintenanceCharges ?? flatMeta.maintenanceCharges;
  const spaceType = getPostSpaceType(postData);
  const houseRules = residential.houseRules || flatMeta.houseRules || "";
  const houseRulesList = Array.isArray(houseRules)
    ? houseRules.filter(Boolean)
    : typeof houseRules === "string" && houseRules.trim()
      ? houseRules.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
      : [];
  const preferredTenants = Array.isArray(residential.preferredTenants) && residential.preferredTenants.length > 0
    ? residential.preferredTenants
    : (Array.isArray(flatMeta.preferredTenants) ? flatMeta.preferredTenants : []);
  const alternativeMobile = residential.alternativeMobile || flatMeta.alternativeMobile || "";
  const commercial = flatMeta.commercial || {};
  const pgHostelMeta = flatMeta.pgHostel || {};
  const electricityBillUrl =
    residential.electricityBillUrl ||
    commercial.electricityBillUrl ||
    pgHostelMeta.electricityBillUrl ||
    flatMeta.electricityBillUrl ||
    flatMeta.electricityBill ||
    postData.electricityBillUrl ||
    "";
  const electricityBillStatus =
    [residential.electricityBillStatus, commercial.electricityBillStatus, pgHostelMeta.electricityBillStatus, flatMeta.electricityBillStatus, postData.electricityBillStatus]
      .find(s => s && s !== "NONE") ||
    (electricityBillUrl ? "PENDING" : "NONE");
  const electricityBillRejectionReason =
    residential.electricityBillRejectionReason ||
    commercial.electricityBillRejectionReason ||
    pgHostelMeta.electricityBillRejectionReason ||
    flatMeta.electricityBillRejectionReason ||
    postData.electricityBillRejectionReason ||
    "";

  const amenitiesList = Array.isArray(flatMeta.amenities) && flatMeta.amenities.length > 0
    ? flatMeta.amenities
    : Array.isArray(residential.amenities) && residential.amenities.length > 0
      ? residential.amenities
      : String(requirement.amenitiesText || "").split(",").map((item) => item.trim()).filter(Boolean);

  const land = flatMeta.land || {};

  const hasRequirementData = Boolean(
    requirement.moveInDate || requirement.availableFromDate || requirement.leaseDurationMonths ||
    requirement.budgetMin || requirement.budgetMax || requirement.occupancyPreference ||
    requirement.genderPreference || requirement.requirementPropertyType || requirement.depositAmount ||
    requirement.tenantType || requirement.occupation || requirement.loanRequired
  );
  const hasProjectData = Boolean(project.projectName || project.launchDate || project.reraNumber || project.brochureUrl);
  const hasInvestmentData = Boolean(investment.thesis);
  const postTypeUpper = String(postData.postType || "").toUpperCase();
  const hasCommercialData = Boolean(commercial.commercialType || commercial.carpetArea || commercial.floorNumber || commercial.washrooms);
  const hasLandData = Boolean(land.landArea || land.soilType || land.waterAvailability || land.roadAccess !== undefined || land.electricityAvailable !== undefined);
  const isCommercialPost = postTypeUpper === "COMMERCIAL_LISTING";
  const isAgriPost = postTypeUpper === "AGRICULTURAL_LISTING";
  const isOpenHouse = postTypeUpper === "OPEN_HOUSE_EVENT";
  const isServicePost = postTypeUpper === "SERVICE_LISTING";

  const isFlatmatePost = postTypeUpper === "FLATMATE_OFFER" || postTypeUpper === "FLATMATE_SEEKING";
  const isPgPost = postTypeUpper === "PG_HOSTEL";
  const isOfferType = postTypeUpper === "FLATMATE_OFFER";
  const fm = flatMeta.flatmate || {};
  const fmMatchScore = postData.flatmateMatchScore;
  const pg = flatMeta.pgHostel || {};

  const reraNumber = project.reraNumber || flatMeta.reraNumber || "";
  const reraVerified = Boolean(flatMeta.reraVerified);
  const projectStatus = flatMeta.projectStatus || "";
  const bookingAmount = flatMeta.bookingAmount;
  const depositAmount = requirement.depositAmount || flatMeta.depositAmount || residential.depositAmount || "";

  const signalBadges = getPropertySignals(postData, { context: "detail" });

  // Nearest transit stop from the already-fetched /amenities/nearby data.
  // Our "metro" bucket is Geoapify's public_transport.{subway,train,tram} —
  // in most of India that's a mainline railway station, not a metro, so read
  // the real category and say which it is.
  const nearestTransit = (amenitiesResult?.items || [])
    .filter((a) => a.type === "metro")
    .sort((a, b) => (a.distance || 0) - (b.distance || 0))[0];
  const transitKind = (() => {
    const cats = Array.isArray(nearestTransit?.tags?.categories) ? nearestTransit.tags.categories.join(" ") : "";
    if (/subway|metro/i.test(cats)) return "metro station";
    if (/tram/i.test(cats)) return "tram stop";
    if (/train|railway|rail/i.test(cats)) return "railway station";
    return "station";
  })();
  const transitBadge = nearestTransit
    ? {
        key: "transit",
        label: (() => {
          const d =
            nearestTransit.distance >= 1000
              ? `${(nearestTransit.distance / 1000).toFixed(1)} km`
              : `${nearestTransit.distance} m`;
          const name = String(nearestTransit.name || "").trim();
          const named = /station|metro|junction|halt|terminus/i.test(name);
          return named ? `${d} from ${name}` : `${d} from ${name} ${transitKind}`;
        })(),
        tone: "info",
      }
    : null;

  const priceInsightBadge = priceInsight?.available
    ? priceInsight.verdict === "below"
      ? { key: "insight", label: `${Math.abs(priceInsight.deltaPct)}% below area average`, tone: "good" }
      : priceInsight.verdict === "above"
        ? { key: "insight", label: `${priceInsight.deltaPct}% above area average`, tone: "warn" }
        : { key: "insight", label: "Priced around the area average", tone: "neutral" }
    : null;
  const allSignalBadges = [
    ...(priceInsightBadge ? [priceInsightBadge] : []),
    ...(transitBadge ? [transitBadge] : []),
    ...signalBadges,
  ];

  const specs = [
    postData.bedrooms ? { icon: Bed, value: postData.bedrooms, label: "Bedrooms" } : null,
    postData.bathrooms ? { icon: Bath, value: postData.bathrooms, label: "Bathrooms" } : null,
    postData.areaSqft ? { icon: Ruler, value: `${Number(postData.areaSqft).toLocaleString("en-IN")} sq.ft`, label: "Area" } : null,
    postData.propertyType ? { icon: Building2, value: postData.propertyType, label: "Type" } : null,
    spaceType ? { icon: Home, value: spaceType, label: "Space Type" } : null,
    furnishing ? { icon: Home, value: titleCase(furnishing), label: "Furnishing" } : null,
    hasParking ? { icon: Car, value: "Available", label: "Parking" } : null,
    possession ? { icon: Clock, value: possession, label: "Possession" } : null,
    facing ? { icon: Compass, value: facing, label: "Facing" } : null,
    floorNumber ? { icon: Layers, value: totalFloors ? `${floorNumber} of ${totalFloors}` : `Floor ${floorNumber}`, label: "Floor" } : null,
    ageOfProperty ? { icon: Calendar, value: ageOfProperty, label: "Age" } : null,
    maintenanceCharges ? { icon: Wallet, value: `₹${Number(maintenanceCharges).toLocaleString("en-IN")}/mo`, label: "Maintenance" } : null,
  ].filter(Boolean);

  const amenitiesData = amenitiesResult?.items || [];
  const amenitiesRadiusKm = ((amenitiesResult?.radius || 2000) / 1000).toFixed(amenitiesResult?.radius % 1000 ? 1 : 0);

  const publishedDiffersFromCreated = postData.publishedAt && postData.createdAt &&
    new Date(postData.publishedAt).getTime() !== new Date(postData.createdAt).getTime();
  const publishBaseTime = postData.publishedAt ? new Date(postData.publishedAt).getTime() : (postData.createdAt ? new Date(postData.createdAt).getTime() : 0);
  const wasEdited = Boolean(
    postData.updatedAt &&
    publishBaseTime &&
    new Date(postData.updatedAt).getTime() - publishBaseTime > 5 * 60 * 1000
  );

  const distinctValidPrices = (() => {
    const list = Array.isArray(postData?.priceHistory)
      ? postData.priceHistory.filter((h) => Number.isFinite(h?.price) && Number(h.price) > 0)
      : [];
    const deduped = [];
    for (const item of list) {
      const itemPrice = Number(item.price);
      if (deduped.length === 0 || Number(deduped[deduped.length - 1].price) !== itemPrice) {
        deduped.push({ ...item, price: itemPrice });
      }
    }
    return deduped;
  })();

  return (
    <AppShell hideHero hideMobileHeader showBackButton title="Property Details">
      <SEO title={postData?.title || "Property Details"} description={postData?.description?.slice(0, 160)} path={"/property/" + id} />
      <div className="min-h-screen bg-base-200">
        {/* Fullscreen Image Modal */}
        {isFullscreen && (
          <div
            className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
            onClick={() => setIsFullscreen(false)}
          >
            {isVideo ? (
              <video
                src={currentImage}
                controls
                autoPlay
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img src={currentImage} alt="Fullscreen view" className="max-w-full max-h-full object-contain" />
            )}
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
        <div className="relative group w-full aspect-video bg-base-200">
          {media.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center text-base-content/50">
              <Home className="size-16" />
            </div>
          ) : isVideo ? (
            <>
              <video
                src={currentImage}
                className="w-full h-full object-cover"
                muted={isHeroVideoMuted}
                loop
                playsInline
                // Same Instagram-style behavior as the marketplace feed cards: no
                // player chrome, autoplay while scrolled into view, pause once
                // scrolled out. Full controls still show in the fullscreen viewer.
                ref={(el) => {
                  if (!el) return;
                  const observer = new IntersectionObserver(
                    ([entry]) => {
                      if (entry.isIntersecting) {
                        el.play().catch(() => {});
                      } else {
                        el.pause();
                      }
                    },
                    { threshold: 0.5 }
                  );
                  observer.observe(el);
                  return () => observer.disconnect();
                }}
              />
              <button
                type="button"
                className="absolute bottom-4 left-4 z-10 grid size-9 place-items-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75 transition-opacity"
                onClick={() => setIsHeroVideoMuted((prev) => !prev)}
                title={isHeroVideoMuted ? "Unmute" : "Mute"}
              >
                {isHeroVideoMuted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
              </button>
            </>
          ) : (
            <img src={currentImage} alt={postData.title || "Property"} className="w-full h-full object-cover" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none">
            <div className="absolute top-4 right-4 flex items-center gap-2 pointer-events-auto">
              {postData.isBoosted && !postData.isBlocked && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 px-3 py-1 text-xs font-extrabold text-white shadow-sm ring-1 ring-amber-300/50">
                  <Zap className="size-3.5 fill-current" />
                  Boosted
                </span>
              )}
              {media.length > 0 && (
                <span className="rounded-full bg-black/55 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-white">
                  {carouselIndex + 1}/{media.length}
                </span>
              )}
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  postData.offerStatus === "ACCEPTED"
                    ? "bg-neutral text-white"
                    : postData.customBadge
                      ? getCustomBadgeClasses(postData.customBadge)
                      : "bg-primary text-white"
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
                className={`size-10 rounded-full flex items-center justify-center transition-colors ${postData.isSavedByMe ? 'bg-primary text-white' : 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75'}`}
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
          <div className="bg-base-100 border-b border-base-300 py-3 px-4 overflow-x-auto">
            <div className="flex gap-2">
              {media.map((img, idx) => (
                <button
                  key={idx}
                  className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === carouselIndex ? 'border-primary' : 'border-transparent hover:border-base-300'
                  }`}
                  onClick={() => setCarouselIndex(idx)}
                >
                  <img src={img} alt={`Thumbnail ${idx + 1}`} loading="lazy" className="w-full h-full object-cover" />
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-base-content break-words">{postData.title || "Property Listing"}</h1>
                      <span className={`rounded-full px-2.5 py-0.5 sm:px-3 sm:py-1 text-xs font-semibold ${postData.status === "PUBLISHED" ? "bg-success/15 text-success" : "bg-base-200 text-base-content/70"}`}>
                        {titleCase(postData.status) || "Active"}
                      </span>
                      {postData.visibility === "PRIVATE" && (
                        <span className="rounded-full bg-neutral px-2.5 py-0.5 text-xs font-semibold text-white">Private</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 text-base-content/70 flex-wrap text-sm sm:text-base">
                      <MapPin className="size-4 sm:size-5 text-primary shrink-0" />
                      <span className="break-words">
                        {[postData.locality, postData.city].filter(Boolean).join(", ") || "Location not specified"}
                      </span>
                      {latitude && longitude && (
                        <button
                          type="button"
                          onClick={() => navigate(`/map-view?propertyId=${postData._id}`)}
                          className="flex items-center gap-1 text-primary text-xs sm:text-sm hover:underline"
                        >
                          <span className="size-2 rounded-full bg-primary"></span>
                          <span>Live Location</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                      {isFlatmatePost ? (
                        <>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isOfferType
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          }`}>
                            <Users className="size-3.5" />
                            {isOfferType ? "Looking for Roommate" : "Need a Room"}
                          </span>
                          {fm.genderPreference && fm.genderPreference !== "Any" && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              fm.genderPreference.toLowerCase() === "male"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                : fm.genderPreference.toLowerCase() === "female"
                                  ? "bg-pink-500/10 text-pink-700 dark:text-pink-400"
                                  : "bg-base-200 text-base-content/70"
                            }`}>
                              {fm.genderPreference} only
                            </span>
                          )}
                          {fmMatchScore != null && (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              fmMatchScore >= 75 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : fmMatchScore >= 55 ? "bg-primary/10 text-primary"
                                  : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                            }`}>
                              <Handshake className="size-3.5" />
                              {fmMatchScore}% match
                            </span>
                          )}
                        </>
                      ) : isPgPost ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-400">
                            <Building2 className="size-3.5" />
                            PG / Hostel
                          </span>
                          {pg.genderPreference && pg.genderPreference !== "any" && (
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              pg.genderPreference === "male"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                                : pg.genderPreference === "female"
                                  ? "bg-pink-500/10 text-pink-700 dark:text-pink-400"
                                  : "bg-base-200 text-base-content/70"
                            }`}>
                              {titleCase(pg.genderPreference)} only
                            </span>
                          )}
                          {pg.foodIncluded && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2.5 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">
                              <UtensilsCrossed className="size-3" />
                              {pg.foodType === "veg" ? "Veg" : pg.foodType === "nonveg" ? "Non-Veg" : pg.foodType === "both" ? "Veg & Non-Veg" : "Food"} included
                            </span>
                          )}
                          {pg.wifiSpeed && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-400">
                              <Wifi className="size-3" />
                              {pg.wifiSpeed}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isCommercialPost ? "bg-teal-500/10 text-teal-700 dark:text-teal-400"
                              : isAgriPost ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : isOpenHouse ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                  : isServicePost ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400"
                                    : "bg-base-200 text-base-content/70"
                          }`}>
                            {isCommercialPost && <Briefcase className="size-3.5" />}
                            {isAgriPost && <MapPin className="size-3.5" />}
                            {isOpenHouse && <Calendar className="size-3.5" />}
                            {isServicePost && <Briefcase className="size-3.5" />}
                            {isCommercialPost ? "Commercial"
                              : isAgriPost ? (postData.listingType?.toLowerCase() === "rent" ? "Land for Lease" : "Land for Sale")
                                : isOpenHouse ? "Open House"
                                  : isServicePost ? "Service"
                                    : String(postData.listingType || "").toLowerCase() === "rent" || postData.postType === "PROPERTY_RENT" ? "For Rent" : titleCase(postData.listingType || postData.postType)}
                          </span>
                          {isCommercialPost && commercial.commercialType && (
                            <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-medium text-base-content/70">
                              {titleCase(commercial.commercialType)}
                            </span>
                          )}
                          {isAgriPost && land.landArea > 0 && (
                            <span className="rounded-full bg-base-200 px-2.5 py-0.5 text-xs font-medium text-base-content/70">
                              {Number(land.landArea).toLocaleString("en-IN")} {land.landAreaUnit || "sq.ft"}
                            </span>
                          )}
                        </>
                      )}
                      {(() => {
                        const transit = extractTransitPill(postData);
                        if (!transit) return null;
                        return (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 border border-blue-500/20">
                            {transit.label}
                          </span>
                        );
                      })()}
                      {isOwner && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                          Your listing
                        </span>
                      )}
                    </div>
                    {allSignalBadges.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {allSignalBadges.map((s) => (
                          <span key={s.key} className={`rounded-full px-2 py-0.5 text-[11px] sm:text-xs font-semibold ${toneClass(s.tone)}`}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Market Appreciation & Deal Insights */}
                    {(postData.appreciationForecast || postData.dealProbability?.level === "HIGH") && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {postData.appreciationForecast && Number(postData.appreciationForecast.annualizedRate) > 0 && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            <span>📈</span>
                            <span>Projected +{postData.appreciationForecast.annualizedRate}% annual appreciation</span>
                            {postData.appreciationForecast.projectedPsf12m && (
                              <span className="text-emerald-700/80 dark:text-emerald-400 font-normal">
                                (Est. ₹{Number(postData.appreciationForecast.projectedPsf12m).toLocaleString("en-IN")}/sq.ft in 12m)
                              </span>
                            )}
                          </div>
                        )}
                        {postData.dealProbability && postData.dealProbability.level === "HIGH" && (
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-900 dark:text-amber-300">
                            <span>🎯</span>
                            <span>{postData.dealProbability.label || "High Deal Likelihood"}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    {isPgPost && pg.sharingTypes?.length > 0 ? (() => {
                      const prices = pg.sharingTypes.map((s) => s.price).filter(Boolean).sort((a, b) => a - b);
                      const lo = prices[0];
                      const hi = prices[prices.length - 1];
                      return (
                        <>
                          <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                            {lo === hi ? formatMoney(lo) : `${formatMoney(lo)} – ${formatMoney(hi)}`}
                          </p>
                          <p className="text-xs text-base-content/50">/month per person</p>
                        </>
                      );
                    })() : (
                      <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">{formatMoney(postData.price)}</p>
                    )}
                    <p className="text-xs sm:text-sm text-base-content/60 mt-0.5">Posted {relativeDate(postData.createdAt)}</p>
                    {wasEdited && <p className="text-[11px] sm:text-xs text-base-content/50">Edited {relativeDate(postData.updatedAt)}</p>}
                    {isAiValuationEnabled && postData.price > 0 && (
                      <div className="mt-2 flex justify-start sm:justify-end">
                        <AiValuationCard
                          postId={postData._id}
                          price={postData.price}
                          propertyType={postData.propertyType}
                          locality={postData.locality}
                          city={postData.city}
                          listingType={postData.listingType}
                          postType={postData.postType}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-6">
                  <button
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      postData.isLikedByMe ? 'bg-error/10 text-error' : 'bg-base-200 text-base-content/70 hover:bg-base-300'
                    }`}
                    onClick={() => toggleLike(postData._id)}
                  >
                    <Heart className={`size-4 ${postData.isLikedByMe ? 'fill-current' : ''}`} />
                    {postData.likesCount || 0} Likes
                  </button>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-200 text-base-content/70 text-sm font-medium">
                    <MessageCircle className="size-4" />
                    {postData.commentCount || 0} Comments
                  </span>
                  <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-200 text-base-content/70 text-sm font-medium">
                    <Eye className="size-4" />
                    {postData.viewCount || 0} Views
                  </span>
                  {postData.shareCount > 0 && (
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-200 text-base-content/70 text-sm font-medium">
                      <Share2 className="size-4" />
                      {postData.shareCount} Shares
                    </span>
                  )}
                  {postData.savesCount > 0 && (
                    <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-base-200 text-base-content/70 text-sm font-medium">
                      <Bookmark className="size-4" />
                      {postData.savesCount} Saves
                    </span>
                  )}
                </div>

                {description && (
                  <div className="mt-6">
                    <p className={`text-base-content/70 leading-relaxed text-lg ${!expandedAbout && shouldShowReadMore ? 'line-clamp-3' : ''}`}>
                      {description}
                    </p>
                    {shouldShowReadMore && (
                      <button
                        onClick={() => setExpandedAbout(!expandedAbout)}
                        className="text-primary font-medium hover:text-primary text-sm mt-2"
                      >
                        {expandedAbout ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </div>
                )}
              </Section>

              {/* Closing tracker — buyer & seller, once an offer is accepted */}
              {deal && (
                <div className="mt-4">
                  <TransactionTracker
                    deal={deal}
                    postId={id}
                    meId={authUser?._id}
                    alreadyReviewed={
                      Boolean(deal?.offer) &&
                      (myOffer?.reviewedByMe ||
                        postOffers.some((o) => String(o._id) === String(deal.offer) && o.reviewedByMe) ||
                        reviewedOfferIds.includes(String(deal.offer)))
                    }
                    onReview={(revieweeName) => setReviewModal({ offerId: deal.offer, revieweeName })}
                  />
                </div>
              )}

              {/* Listing performance & Boost — owner only */}
              {isOwner && !postData.isDeleted && !postData.isBlocked && (
                <div className="mt-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50/90 via-amber-100/50 to-amber-50/80 p-4 shadow-xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-700">
                        <Zap className="size-5 fill-amber-600 text-amber-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                            {postData.isBoosted ? "Boost Active" : "Boost Listing (1 Coin)"}
                          </h4>
                          {postData.isBoosted && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-300">
                              Priority Ranked
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-amber-900/80 font-medium">
                          {postData.isBoosted
                            ? "Your property is currently prioritized at the top of feeds."
                            : "Feature your property at the top of feeds for 24 hours to get more buyer inquiries."}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowBoostModal(true)}
                      className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:from-amber-600 hover:to-amber-700 transition-all"
                    >
                      <Zap className="size-3.5 fill-white" />
                      <span>{postData.isBoosted ? "Extend Boost" : "Boost Now"}</span>
                    </button>
                  </div>

                  {/* Owner Address Verification Callout */}
                  {electricityBillStatus !== "VERIFIED" && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/10 to-transparent border border-emerald-500/25">
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-base-content">
                              {electricityBillStatus === "PENDING"
                                ? "Address Verification Under Review"
                                : electricityBillStatus === "REJECTED"
                                  ? "Address Verification Rejected"
                                  : "Verify Property Address"}
                            </p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              electricityBillStatus === "PENDING"
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                                : electricityBillStatus === "REJECTED"
                                  ? "bg-error/20 text-error"
                                  : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            }`}>
                              {electricityBillStatus === "PENDING"
                                ? "⏳ In Review"
                                : electricityBillStatus === "REJECTED"
                                  ? "⚠️ Action Required"
                                  : "⚡ +25% Reach Boost"}
                            </span>
                          </div>
                          <p className="text-xs text-base-content/70 font-medium mt-0.5">
                            {electricityBillStatus === "PENDING"
                              ? "Admin is reviewing your electricity bill. You can replace the document if needed."
                              : electricityBillStatus === "REJECTED"
                                ? (electricityBillRejectionReason ? `Reason: ${electricityBillRejectionReason}` : "Upload a clear electricity bill to verify your address.")
                                : "Upload your electricity bill to get the verified badge & boost feed visibility."}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowVerifyModal(true)}
                        className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-all self-start sm:self-auto"
                      >
                        <ShieldCheck className="size-3.5" />
                        <span>
                          {electricityBillStatus === "PENDING"
                            ? "Replace Bill"
                            : electricityBillStatus === "REJECTED"
                              ? "Re-upload Bill"
                              : "Verify Address"}
                        </span>
                      </button>
                    </div>
                  )}

                  <ListingPerformance post={postData} />
                </div>
              )}

              {/* Offers Received — owner only. Collapsed to the most recent
                  offer by default; the rest are behind "View all". */}
              {isOwner && postOffers.length > 0 && (
                <Section title="Offers Received" icon={TrendingUp}>
                  <div className="space-y-3">
                    {[...postOffers]
                      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
                      .slice(0, showAllOffers ? postOffers.length : 1)
                      .map((offer) => {
                      const isActionable = ["pending", "countered"].includes(offer.status) &&
                        String(offer.lastActionBy) !== String(authUser?._id);
                      const statusStyles = {
                        pending: "bg-warning/10 text-warning",
                        countered: "bg-warning/10 text-warning",
                        accepted: "bg-success/10 text-success",
                        declined: "bg-error/10 text-error",
                        withdrawn: "bg-base-200 text-base-content/60",
                      };
                      return (
                        <div key={offer._id} className="rounded-xl border border-base-300 p-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-semibold text-base-content truncate">{offer.buyer?.fullName || "Buyer"}</span>
                              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[offer.status] || "bg-base-200 text-base-content/70"}`}>
                                {titleCase(offer.status)}
                              </span>
                            </div>
                            <span className="text-lg font-bold text-primary">{formatMoney(offer.currentPrice)}</span>
                          </div>
                          {offer.history?.length > 0 && (
                            <div className="mt-3 border-t border-base-200 pt-3">
                              <OfferHistoryTimeline
                                history={offer.history}
                                buyerName={offer.buyer?.fullName}
                                ownerName={postData.author?.fullName}
                                buyerId={offer.buyer?._id}
                                currentUserId={authUser?._id}
                              />
                            </div>
                          )}
                          {offer.status === "accepted" && (
                            <Link
                              to={`/marketplace?section=chat&userId=${offer.buyer?._id}`}
                              className="mt-3 block text-center text-xs font-medium text-success underline hover:text-success"
                            >
                              Chat with {offer.buyer?.fullName || "buyer"} to connect and continue
                            </Link>
                          )}
                          {offer.status === "accepted" && !offer.reviewedByMe && !reviewedOfferIds.includes(offer._id) && (
                            <button
                              className="mt-3 w-full rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success"
                              onClick={() => setReviewModal({ offerId: offer._id, revieweeName: offer.buyer?.fullName })}
                            >
                              Leave a review
                            </button>
                          )}
                          {isActionable && (
                            <div className="mt-3 flex gap-2">
                              <button
                                className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success"
                                onClick={() => respondToOffer({ offerId: offer._id, action: "accept" })}
                                disabled={isRespondPending}
                              >
                                Accept
                              </button>
                              <button
                                className="flex-1 rounded-lg border border-primary/30 bg-base-100 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                                onClick={() => setOfferModal({ mode: "counter", offerId: offer._id })}
                              >
                                Counter
                              </button>
                              <button
                                className="flex-1 rounded-lg border border-error/30 bg-base-100 px-3 py-2 text-xs font-semibold text-error hover:bg-error/10"
                                onClick={() => respondToOffer({ offerId: offer._id, action: "decline" })}
                                disabled={isRespondPending}
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {postOffers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setShowAllOffers((v) => !v)}
                      className="mt-3 w-full rounded-xl border border-base-300 bg-base-100 py-2.5 text-sm font-semibold text-base-content transition-colors hover:bg-base-200"
                    >
                      {showAllOffers ? "Show less" : `View all ${postOffers.length} offers`}
                    </button>
                  )}
                </Section>
              )}

              {/* Specifications */}
              {specs.length > 0 && (
                <Section title={`Property Specifications (${specs.length})`} icon={Building2}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3">
                    {specs.map((spec, idx) => (
                      <SpecCard key={idx} icon={spec.icon} value={spec.value} label={spec.label} />
                    ))}
                  </div>
                </Section>
              )}

              {/* Amenities (features listed by the poster) */}
              {amenitiesList.length > 0 && (
                <Section title={`Amenities (${amenitiesList.length})`} icon={Sparkles}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                    {amenitiesList.map((amenity, idx) => {
                      const IconComp = getAmenityIcon(amenity);
                      return (
                        <div
                          key={idx}
                          className="group flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-base-300/80 bg-base-200/50 p-2.5 sm:p-3 text-xs sm:text-sm font-medium text-base-content transition-all hover:border-primary/40 hover:bg-base-200 hover:shadow-xs min-w-0"
                        >
                          <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                            <IconComp className="size-4 sm:size-4.5" />
                          </div>
                          <span className="min-w-0 flex-1 leading-snug break-words">{amenity}</span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* Preferred Tenants */}
              {preferredTenants.length > 0 && (
                <Section title="Preferred Tenants" icon={Users}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3">
                    {preferredTenants.map((tenant, idx) => {
                      const IconComp = getTenantIcon(tenant);
                      return (
                        <div
                          key={idx}
                          className="flex items-center gap-2.5 sm:gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:p-3.5 text-xs sm:text-sm font-semibold text-base-content transition-all hover:bg-emerald-500/10 hover:border-emerald-500/40 min-w-0"
                        >
                          <div className="grid size-8 sm:size-9 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                            <IconComp className="size-4 sm:size-4.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-base-content leading-snug break-words">{tenant}</p>
                            <p className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Eligible Tenant</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              )}

              {/* House Rules */}
              {houseRulesList.length > 0 && (
                <Section title="House Rules" icon={FileText}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {houseRulesList.map((rule, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 rounded-xl bg-base-200/60 hover:bg-base-200 border border-base-300/80 transition-all shadow-2xs"
                      >
                        <div className="size-7 rounded-lg bg-error/10 text-error flex items-center justify-center shrink-0">
                          <Ban className="size-3.5" />
                        </div>
                        <span className="text-sm font-medium text-base-content leading-snug">{rule}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Flatmate details — for FLATMATE_OFFER / FLATMATE_SEEKING posts */}
              {isFlatmatePost && (
                <Section title={isOfferType ? "Room Details" : "What I'm Looking For"} icon={Users}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Room type" value={fm.roomType} />
                    <InfoRow label="Occupancy" value={fm.occupancy > 1 ? `${fm.occupancy}-sharing` : fm.occupancy === 1 ? "Single" : null} />
                    <InfoRow label="Furnishing" value={fm.furnishing} />
                    <InfoRow label="Rent per person" value={fm.rentPerPerson ? `₹${Number(fm.rentPerPerson).toLocaleString("en-IN")}/mo` : null} />
                    <InfoRow label="Budget range" value={
                      (fm.budgetMin || fm.budgetMax)
                        ? `₹${Number(fm.budgetMin || 0).toLocaleString("en-IN")} – ₹${Number(fm.budgetMax || 0).toLocaleString("en-IN")}`
                        : null
                    } />
                    <InfoRow label="Deposit" value={fm.depositAmount ? `₹${Number(fm.depositAmount).toLocaleString("en-IN")}` : null} />
                    <InfoRow label="Available from" value={fm.availableFrom} />
                    <InfoRow label="Gender preference" value={fm.genderPreference} />
                    <InfoRow label="Food preference" value={fm.foodPreference} />
                    <InfoRow label="Smoking" value={fm.smoking} />
                    <InfoRow label="Drinking" value={fm.drinking} />
                    <InfoRow label="Occupation" value={Array.isArray(fm.occupation) ? fm.occupation.join(", ") : fm.occupation} />
                    <InfoRow label="College" value={fm.collegeName} />
                    <InfoRow label="Workplace" value={fm.workplaceName} />
                    <InfoRow label="Group size" value={fm.groupSize > 0 ? `${fm.groupSize} people` : null} />
                  </div>
                  {fm.preferredLocalities?.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-base-content/70 mb-2">Preferred Localities</p>
                      <div className="flex flex-wrap gap-2">
                        {fm.preferredLocalities.map((loc) => (
                          <span key={loc} className="inline-flex items-center gap-1 rounded-full border border-base-300 bg-base-200/50 px-2.5 py-1 text-xs font-medium text-base-content/70">
                            <MapPin className="size-3" />
                            {loc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(fm.targetAudience?.length > 0 || fm.lifestyleTags?.length > 0 || fm.amenityTags?.length > 0) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {[...(fm.targetAudience || []), ...(fm.lifestyleTags || []), ...(fm.amenityTags || [])].map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-full border border-base-300 px-2.5 py-0.5 text-xs font-medium text-base-content/70">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Section>
              )}

              {/* PG/Hostel details */}
              {isPgPost && (
                <>
                  {/* Sharing Types & Pricing */}
                  {pg.sharingTypes?.length > 0 && (
                    <Section title="Room Types & Pricing" icon={Bed}>
                      <div className="grid gap-3">
                        {pg.sharingTypes.map((s) => (
                          <div key={s.type} className="flex items-center justify-between p-4 rounded-xl bg-base-200/60">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Bed className="size-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{titleCase(s.type)} Sharing</p>
                                <p className="text-xs text-base-content/50">Per person / month</p>
                              </div>
                            </div>
                            <p className="text-lg font-bold text-primary">{formatMoney(s.price)}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        {pg.securityDeposit > 0 && (
                          <div className="p-3 rounded-xl bg-base-200/50">
                            <p className="text-xs text-base-content/50">Security Deposit</p>
                            <p className="font-bold">{formatMoney(pg.securityDeposit)}</p>
                          </div>
                        )}
                        {pg.lockInPeriodMonths > 0 && (
                          <div className="p-3 rounded-xl bg-base-200/50">
                            <p className="text-xs text-base-content/50">Lock-in Period</p>
                            <p className="font-bold">{pg.lockInPeriodMonths} months</p>
                          </div>
                        )}
                      </div>
                    </Section>
                  )}

                  {/* Occupancy */}
                  {(pg.totalBeds > 0) && (
                    <Section title="Occupancy" icon={Users}>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        <div className="text-center p-3 rounded-xl bg-base-200/50">
                          <p className="text-2xl font-bold">{pg.totalBeds}</p>
                          <p className="text-xs text-base-content/50">Total Beds</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-green-500/10">
                          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{pg.availableBeds || 0}</p>
                          <p className="text-xs text-green-700/70 dark:text-green-400/70">Available</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-base-200/50">
                          <p className="text-2xl font-bold">{pg.totalBeds - (pg.availableBeds || 0)}</p>
                          <p className="text-xs text-base-content/50">Occupied</p>
                        </div>
                      </div>
                      <div className="w-full bg-base-300 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.round(((pg.totalBeds - (pg.availableBeds || 0)) / pg.totalBeds) * 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-base-content/50 text-right mt-1">
                        {Math.round(((pg.totalBeds - (pg.availableBeds || 0)) / pg.totalBeds) * 100)}% occupied
                      </p>
                    </Section>
                  )}

                  {/* Food & Menu */}
                  {pg.foodIncluded && (
                    <Section title="Food & Menu" icon={UtensilsCrossed}>
                      <div className="flex items-center gap-2 mb-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                          pg.foodType === "veg"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : pg.foodType === "nonveg"
                              ? "bg-red-500/10 text-red-700 dark:text-red-400"
                              : "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                        }`}>
                          <UtensilsCrossed className="size-3.5" />
                          {pg.foodType === "veg" ? "Vegetarian" : pg.foodType === "nonveg" ? "Non-Vegetarian" : "Veg & Non-Veg"}
                        </span>
                      </div>
                      {pg.weeklyMenu?.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-base-content/70 mb-3">Weekly Menu</h3>
                          <div className="overflow-x-auto -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-xs text-base-content/50 uppercase tracking-wider">
                                  <th className="text-left pb-2 pr-4 font-semibold">Day</th>
                                  <th className="text-left pb-2 pr-4 font-semibold">Breakfast</th>
                                  <th className="text-left pb-2 pr-4 font-semibold">Lunch</th>
                                  <th className="text-left pb-2 font-semibold">Dinner</th>
                                </tr>
                              </thead>
                              <tbody>
                                {pg.weeklyMenu.map((day) => (
                                  <tr key={day.day} className="border-t border-base-200">
                                    <td className="py-2.5 pr-4 font-medium text-base-content/80 whitespace-nowrap">{day.day}</td>
                                    <td className="py-2.5 pr-4 text-base-content/60">{day.breakfast}</td>
                                    <td className="py-2.5 pr-4 text-base-content/60">{day.lunch}</td>
                                    <td className="py-2.5 text-base-content/60">{day.dinner}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </Section>
                  )}

                  {/* House Rules */}
                  {pg.houseRules?.length > 0 && (
                    <Section title="House Rules" icon={ShieldCheck}>
                      <div className="space-y-2">
                        {pg.houseRules.map((rule, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-base-200/40">
                            <span className="mt-0.5 w-5 h-5 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{i + 1}</span>
                            </span>
                            <span className="text-sm text-base-content/80">{rule}</span>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Nearby Places */}
                  {(pg.nearbyColleges?.length > 0 || pg.nearbyOffices?.length > 0) && (
                    <Section title="Nearby Places" icon={MapPin}>
                      {pg.nearbyColleges?.length > 0 && (
                        <div className="mb-4">
                          <h3 className="text-sm font-semibold text-base-content/70 mb-2 flex items-center gap-1.5">
                            <GraduationCap className="size-4 text-primary" />
                            Colleges & Universities
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {pg.nearbyColleges.map((c) => (
                              <span key={c} className="inline-flex items-center rounded-full border border-base-300 bg-base-200/50 px-3 py-1 text-xs font-medium text-base-content/70">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {pg.nearbyOffices?.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-base-content/70 mb-2 flex items-center gap-1.5">
                            <Briefcase className="size-4 text-primary" />
                            Offices & IT Parks
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {pg.nearbyOffices.map((o) => (
                              <span key={o} className="inline-flex items-center rounded-full border border-base-300 bg-base-200/50 px-3 py-1 text-xs font-medium text-base-content/70">
                                {o}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </Section>
                  )}

                  {/* Ratings Breakdown */}
                  {pg.avgRatings && pg.reviewCount > 0 && (
                    <Section title={`Ratings & Reviews (${pg.reviewCount})`} icon={Star}>
                      <div className="flex items-center gap-4 mb-5">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary">
                            {(() => {
                              const vals = Object.values(pg.avgRatings).filter((v) => typeof v === "number" && v > 0);
                              return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
                            })()}
                          </div>
                          <div className="flex gap-0.5 mt-1 justify-center">
                            {[1, 2, 3, 4, 5].map((n) => {
                              const avg = (() => {
                                const vals = Object.values(pg.avgRatings).filter((v) => typeof v === "number" && v > 0);
                                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
                              })();
                              return <Star key={n} className={`size-4 ${n <= Math.round(avg) ? "fill-yellow-400 text-yellow-400" : "text-base-content/20"}`} />;
                            })}
                          </div>
                          <p className="text-xs text-base-content/50 mt-1">{pg.reviewCount} reviews</p>
                        </div>
                        <div className="flex-1 space-y-2">
                          {[
                            { key: "food", label: "Food" },
                            { key: "cleanliness", label: "Cleanliness" },
                            { key: "wifi", label: "WiFi" },
                            { key: "water", label: "Water" },
                            { key: "safety", label: "Safety" },
                            { key: "landlord", label: "Landlord" },
                            { key: "value_for_money", label: "Value" },
                            { key: "location", label: "Location" },
                          ].map((cat) => {
                            const val = pg.avgRatings[cat.key] || 0;
                            return (
                              <div key={cat.key} className="flex items-center gap-2">
                                <span className="text-xs w-20 text-base-content/60">{cat.label}</span>
                                <div className="flex-1 bg-base-200 rounded-full h-1.5 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${val >= 4 ? "bg-green-500" : val >= 3 ? "bg-yellow-500" : "bg-red-500"}`}
                                    style={{ width: `${(val / 5) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium w-6 text-right">{val.toFixed(1)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Section>
                  )}

                  {/* PG Amenities */}
                  {pg.amenities?.length > 0 && (
                    <Section title="PG Amenities" icon={Sparkles}>
                      <div className="flex flex-wrap gap-2">
                        {pg.amenities.map((a) => {
                          const iconMap = {
                            wifi: Wifi, laundry: Shirt, parking: Car, power_backup: Zap,
                            cctv: ShieldCheck, housekeeping: Sparkles, ac: Wind, gym: Dumbbell,
                            water_purifier: Droplets, fridge: Home, tv: Home,
                          };
                          const Ic = iconMap[a.toLowerCase()] || Sparkles;
                          return (
                            <span key={a} className="inline-flex items-center gap-1.5 rounded-xl border border-base-300 bg-base-200/50 px-3 py-1.5 text-xs font-medium text-base-content/70">
                              <Ic className="size-3.5 text-primary" />
                              {titleCase(a.replace(/_/g, " "))}
                            </span>
                          );
                        })}
                      </div>
                    </Section>
                  )}
                </>
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
                    <InfoRow label="Occupation" value={Array.isArray(requirement.occupation) ? requirement.occupation.join(", ") : requirement.occupation} />
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
                      className="mt-4 inline-flex items-center gap-2 text-primary hover:text-primary font-medium text-sm"
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
                  <p className="text-base-content/70 leading-relaxed">{investment.thesis}</p>
                </Section>
              )}

              {/* Commercial details — for COMMERCIAL_LISTING posts */}
              {hasCommercialData && (
                <Section title="Commercial Details" icon={Building2}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Commercial type" value={commercial.commercialType ? titleCase(commercial.commercialType) : null} />
                    <InfoRow label="Carpet area" value={commercial.carpetArea ? `${Number(commercial.carpetArea).toLocaleString("en-IN")} sq.ft` : null} />
                    <InfoRow label="Floor" value={commercial.floorNumber != null ? `Floor ${commercial.floorNumber}` : null} />
                    <InfoRow label="Washrooms" value={commercial.washrooms || null} />
                  </div>
                </Section>
              )}

              {/* Agricultural / Land details — for AGRICULTURAL_LISTING posts */}
              {hasLandData && (
                <Section title="Land Details" icon={MapPin}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InfoRow label="Land area" value={
                      land.landArea
                        ? `${Number(land.landArea).toLocaleString("en-IN")} ${land.landAreaUnit || "sq.ft"}`
                        : null
                    } />
                    <InfoRow label="Soil type" value={land.soilType ? titleCase(land.soilType) : null} />
                    <InfoRow label="Water availability" value={land.waterAvailability ? titleCase(land.waterAvailability) : null} />
                    <InfoRow label="Road access" value={land.roadAccess != null ? (land.roadAccess ? "Yes" : "No") : null} />
                    <InfoRow label="Electricity" value={land.electricityAvailable != null ? (land.electricityAvailable ? "Available" : "Not available") : null} />
                  </div>
                </Section>
              )}

              {/* Financial Details */}
              {(postData.price || maintenanceCharges || bookingAmount || depositAmount) && (
                <Section title="Financial Details" icon={Wallet}>
                  <div className="space-y-1">
                    <InfoRow
                      label={postData.listingType === "Rent" ? "Monthly Rent" : "Price"}
                      value={
                        <span className="text-xl font-bold">
                          {formatMoney(postData.price)}
                          {postData.listingType === "Rent" ? <span className="text-sm font-normal text-base-content/60">/mo</span> : ""}
                        </span>
                      }
                    />
                    {depositAmount ? <InfoRow label="Security Deposit" value={formatMoney(depositAmount)} /> : null}
                    <InfoRow label="Maintenance charges" value={maintenanceCharges ? `₹${Number(maintenanceCharges).toLocaleString("en-IN")}/month` : null} />
                    <InfoRow label="Booking amount" value={bookingAmount ? formatMoney(bookingAmount) : null} />
                  </div>
                </Section>
              )}

              {/* Negotiation History — buyer's own offer thread on this post */}
              {!isOwner && myOffer?.history?.length > 0 && (
                <Section title="Your Negotiation" icon={TrendingUp}>
                  <OfferHistoryTimeline
                    history={myOffer.history}
                    buyerName={authUser?.fullName}
                    ownerName={postData.author?.fullName}
                    buyerId={authUser?._id}
                    currentUserId={authUser?._id}
                  />
                </Section>
              )}

              {/* Price History — only shown when there has actually been a real price change */}
              {distinctValidPrices.length > 1 && (
                <Section title="Price History" icon={TrendingUp}>
                  <PriceHistoryChart history={distinctValidPrices} />
                </Section>
              )}

              {/* Locality Price Insights */}
              {postData.city && postData.locality && (
                <Section title={`${postData.locality} Price Insights`} icon={BarChart3}>
                  <LocalityInsightsCard
                    city={postData.city}
                    locality={postData.locality}
                    price={postData.price}
                    areaSqft={postData.areaSqft}
                    listingType={postData.listingType}
                  />
                </Section>
              )}

              {/* Location Section */}
              {latitude && longitude && (
                <Section title="Location & Neighborhood" icon={MapPin}>
                  <div className="h-80 rounded-xl overflow-hidden bg-base-200 mb-6">
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

                  {latitude && longitude && (
                    <NeighbourhoodSafetyCard
                      latitude={latitude}
                      longitude={longitude}
                      locality={postData.locality}
                      city={postData.city}
                      district={postData.city}
                    />
                  )}

                  {!amenitiesLoading && !amenitiesError && amenitiesData.length > 0 && (
                    <NeighbourhoodSummary
                      items={amenitiesData}
                      locality={postData.locality}
                      city={postData.city}
                      className="mb-6"
                    />
                  )}

                  {amenitiesLoading && (
                    <p className="text-sm text-base-content/60">Loading nearby amenities...</p>
                  )}
                  {!amenitiesLoading && amenitiesError && (
                    <p className="text-sm text-error">Couldn't load nearby amenities. Try again in a moment.</p>
                  )}
                  {!amenitiesLoading && !amenitiesError && amenitiesData.length === 0 && (
                    <p className="text-sm text-base-content/50">No amenities found within {amenitiesRadiusKm}km.</p>
                  )}
                  {!amenitiesLoading && !amenitiesError && amenitiesData.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAmenitiesModal(true)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-base-300 bg-base-100 px-4 py-3 text-sm font-medium text-base-content transition-colors hover:bg-base-200"
                    >
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-primary" />
                        View all {amenitiesData.length} nearby places
                      </span>
                      <span className="text-base-content/40">→</span>
                    </button>
                  )}
                </Section>
              )}

              {/* Legal & Ownership Information */}
              {(reraVerified || reraNumber || possession || projectStatus || electricityBillUrl || isOwner) && (
                <Section title="Legal & Ownership Details" icon={ShieldCheck}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {electricityBillUrl && electricityBillStatus === "VERIFIED" ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl md:col-span-2 border bg-success/10 border-success/30">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-success/20 text-success">
                            <ShieldCheck className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-base-content">Address Verification</p>
                            <p className="text-xs text-base-content/70 leading-snug break-words">Electricity bill verified by admin</p>
                          </div>
                        </div>
                        <span className="font-bold text-success bg-success/15 px-3 py-1 rounded-full text-xs sm:text-sm shrink-0 self-start sm:self-auto">✓ Address Verified</span>
                      </div>
                    ) : electricityBillUrl && isOwner ? (
                      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl md:col-span-2 border ${
                        electricityBillStatus === "REJECTED"
                          ? "bg-error/10 border-error/30"
                          : "bg-amber-500/10 border-amber-500/30"
                      }`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`size-9 rounded-lg flex items-center justify-center shrink-0 ${
                            electricityBillStatus === "REJECTED"
                              ? "bg-error/20 text-error"
                              : "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          }`}>
                            {electricityBillStatus === "REJECTED" ? (
                              <AlertTriangle className="size-5" />
                            ) : (
                              <Clock className="size-5" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-base-content">Address Verification</p>
                            <p className="text-xs text-base-content/70 leading-snug break-words">
                              {electricityBillStatus === "REJECTED"
                                ? (electricityBillRejectionReason ? `Rejected: ${electricityBillRejectionReason}` : "Electricity bill rejected by admin")
                                : "Electricity bill submitted & awaiting admin review"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                          <button
                            type="button"
                            onClick={() => setShowVerifyModal(true)}
                            className="btn btn-xs btn-outline btn-primary"
                          >
                            {electricityBillStatus === "REJECTED" ? "Re-upload" : "Replace Bill"}
                          </button>
                          <span className={`font-semibold px-3 py-1 rounded-full text-xs sm:text-sm ${
                            electricityBillStatus === "REJECTED"
                              ? "font-bold text-error bg-error/15"
                              : "font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15"
                          }`}>
                            {electricityBillStatus === "REJECTED"
                              ? "Verification Rejected"
                              : "⏳ Verification Pending"}
                          </span>
                        </div>
                      </div>
                    ) : isOwner ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl md:col-span-2 border border-primary/25 bg-primary/5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-primary/15 text-primary">
                            <ShieldCheck className="size-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-base-content">Verify Property Address</p>
                            <p className="text-xs text-base-content/70">
                              Upload electricity bill to get the "✓ Address Verified" badge & 25% higher reach.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowVerifyModal(true)}
                          className="btn btn-sm btn-primary self-start sm:self-auto shrink-0"
                        >
                          Verify Now
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl md:col-span-2 border border-base-200 bg-base-200/40">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-lg flex items-center justify-center shrink-0 bg-base-300 text-base-content/50">
                            <ShieldCheck className="size-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-base-content">Address Verification</p>
                            <p className="text-xs text-base-content/60">This property's address is not yet verified</p>
                          </div>
                        </div>
                        <span className="rounded-full px-2.5 py-0.5 text-xs font-semibold bg-base-300 text-base-content/60">
                          Unverified
                        </span>
                      </div>
                    )}
                    {reraVerified && (
                      <div className="flex items-center justify-between p-4 bg-success/10 rounded-xl">
                        <span className="text-base-content/70">RERA Verified</span>
                        <span className="font-bold text-success bg-success/15 px-3 py-1 rounded-full text-sm">✓ Verified</span>
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
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs text-base-content/60 mb-1">Posted</p>
                    <p className="font-medium text-base-content">{formatDate(postData.createdAt)}</p>
                  </div>
                  {publishedDiffersFromCreated && (
                    <div className="p-4 bg-base-200 rounded-xl">
                      <p className="text-xs text-base-content/60 mb-1">Published</p>
                      <p className="font-medium text-base-content">{formatDate(postData.publishedAt)}</p>
                    </div>
                  )}
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs text-base-content/60 mb-1">Post Type</p>
                    <p className="font-medium text-base-content">{titleCase(postData.postType) || "Property"}</p>
                  </div>
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs text-base-content/60 mb-1">Listing Type</p>
                    <p className="font-medium text-base-content">{postData.listingType || "Sale"}</p>
                  </div>
                  <div className="p-4 bg-base-200 rounded-xl">
                    <p className="text-xs text-base-content/60 mb-1">Visibility</p>
                    <p className="font-medium text-base-content">{titleCase(postData.visibility) || "Public"}</p>
                  </div>
                </div>
              </Section>

              {!String(postData?.postType || "").startsWith("REQUIREMENT_") && (
                <SimilarProperties postId={id} />
              )}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-24 space-y-6">
                {/* Seller Profile Card */}
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6">
                  <Link to={`/users/${postData.author?._id}`} className="flex items-center gap-4 mb-6 group">
                    <div className="size-20 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                      <div className="size-full rounded-full bg-base-100 p-0.5">
                        {postData.author?.profilePic ? (
                          <img src={postData.author.profilePic} alt={postData.author.fullName} loading="lazy" className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-base-200 rounded-full">
                            <span className="text-2xl font-bold text-base-content/70">{postData.author?.fullName?.charAt(0) || "U"}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xl font-bold text-base-content truncate group-hover:text-primary transition-colors">
                          {postData.author?.fullName || "Unknown"}
                        </p>
                      </div>
                      <p className="text-sm text-base-content/70">
                        {titleCase(postData.author?.activeRole || postData.author?.primaryRole || postData.authorRole) || "Property Owner"}
                      </p>
                      {postData.author?.city && (
                        <p className="text-xs text-base-content/50 mt-0.5 flex items-center gap-1">
                          <MapPin className="size-3" />
                          {postData.author.city}
                        </p>
                      )}
                    </div>
                  </Link>

                  {(() => {
                    const trust = getSellerTrustSignals(postData.author);
                    return trust.length > 0 ? (
                      <div className="mb-6 -mt-2 flex flex-wrap gap-1.5">
                        {trust.map((s) => (
                          <span
                            key={s.key}
                            className={`rounded-full ${s.color} px-2.5 py-1 text-[11px] font-semibold ${s.textColor}`}
                          >
                            {s.label}
                          </span>
                        ))}
                      </div>
                    ) : null;
                  })()}

                  {electricityBillUrl && electricityBillStatus === "VERIFIED" && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-xs font-semibold text-success">
                      <ShieldCheck className="size-4 shrink-0" />
                      <span>Address Verified via Electricity Bill</span>
                    </div>
                  )}
                  {electricityBillUrl && electricityBillStatus === "PENDING" && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Clock className="size-4 shrink-0" />
                      <span>Address Verification Under Review</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    {postData.author?.mobileNumber && (
                      <>
                        <a
                          href={`tel:${postData.author.mobileNumber}`}
                          className="w-full py-3 px-4 bg-primary hover:bg-primary text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <Phone className="size-5" />
                          {postData.author.mobileNumber}
                        </a>
                        <a
                          href={`https://wa.me/${postData.author.mobileNumber.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-3 px-4 bg-success hover:bg-success text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="size-5" />
                          WhatsApp
                        </a>
                      </>
                    )}
                    {alternativeMobile && (
                      <a
                        href={`tel:${alternativeMobile}`}
                        className="w-full py-3 px-4 bg-base-200 hover:bg-base-300 text-base-content font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                        <Phone className="size-4" />
                        Alt: {alternativeMobile}
                      </a>
                    )}
                    {!isOwner && (
                      connectionStatus === "friends" ? (
                        <Link
                          to={`/marketplace?section=chat&userId=${postData.author?._id}`}
                          className="w-full py-3 px-4 bg-base-100 border-2 border-primary text-primary font-semibold rounded-xl hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="size-5" />
                          Chat
                        </Link>
                      ) : connectionStatus === "pending_sent" ? (
                        <button
                          type="button"
                          disabled
                          className="w-full py-3 px-4 bg-base-200 text-base-content/60 font-semibold rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          Request Sent
                        </button>
                      ) : connectionStatus === "pending_received" ? (
                        <Link
                          to="/connections"
                          className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary transition-colors flex items-center justify-center gap-2"
                        >
                          Respond to Request
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendConnectionRequest()}
                          disabled={isConnecting}
                          className="w-full py-3 px-4 bg-base-100 border-2 border-primary text-primary font-semibold rounded-xl hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <UserRoundPlus className="size-5" />
                          {isConnecting ? "Connecting..." : "Connect"}
                        </button>
                      )
                    )}
                    <Link
                      to={`/users/${postData.author?._id}`}
                      className="w-full py-3 px-4 bg-base-100 border border-base-300 text-base-content font-semibold rounded-xl hover:bg-base-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <Users className="size-5" />
                      View Profile
                    </Link>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6 space-y-3">
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                      postData.isLikedByMe
                        ? 'bg-error/10 text-error border border-error/30'
                        : 'bg-base-100 text-base-content border border-base-300 hover:bg-base-200'
                    }`}
                    onClick={() => toggleLike(postData._id)}
                  >
                    <Heart className={`size-5 ${postData.isLikedByMe ? 'fill-current' : ''}`} />
                    {postData.isLikedByMe ? 'Liked' : 'Like'}
                  </button>
                  <button
                    className={`w-full py-3 px-4 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 ${
                      postData.isSavedByMe
                        ? 'bg-primary/10 text-primary border border-primary/30'
                        : 'bg-base-100 text-base-content border border-base-300 hover:bg-base-200'
                    }`}
                    onClick={() => toggleSave(postData._id)}
                  >
                    {postData.isSavedByMe ? <BookmarkCheck className="size-5" /> : <Bookmark className="size-5" />}
                    {postData.isSavedByMe ? 'Saved' : 'Save'}
                  </button>

                  {!isOwner && !isRequirementPost && postData.price > 0 && (
                    <PriceAlertButton postId={postData._id} currentPrice={postData.price} />
                  )}

                  <button
                    className="w-full py-3 px-4 bg-base-100 text-base-content border border-base-300 font-semibold rounded-xl hover:bg-base-200 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setShowShareModal(true)}
                  >
                    <Share2 className="size-5" />
                    Share
                  </button>

                  {!isOwner && isPgPost && (!myBooking || myBooking.status === "rejected") && (
                    <button
                      className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                      onClick={() => setShowPgBookingModal(true)}
                    >
                      <Home className="size-5" />
                      {myBooking?.status === "rejected" ? "Re-apply to This PG" : "Book This PG"}
                    </button>
                  )}
                  {!isOwner && isPgPost && myBooking && (
                    <div className={`w-full rounded-xl border p-4 space-y-2 ${
                      myBooking.status === "pending" ? "border-warning/40 bg-warning/10" :
                      myBooking.status === "active" ? "border-success/40 bg-success/10" :
                      myBooking.status === "rejected" ? "border-error/40 bg-error/10" :
                      "border-primary/40 bg-primary/10"
                    }`}>
                      {/* Status timeline dots */}
                      <div className="flex items-center gap-1 mb-2">
                        {["pending", "approved", "active"].map((s, i) => {
                          const steps = ["pending", "approved", "active"];
                          const currentIdx = steps.indexOf(myBooking.status);
                          const isReject = myBooking.status === "rejected";
                          const done = !isReject && currentIdx >= i;
                          return (
                            <div key={s} className="flex items-center gap-1">
                              <div className={`w-2.5 h-2.5 rounded-full ${
                                isReject && i === 0 ? "bg-error" :
                                done ? "bg-success" : "bg-base-300"
                              }`} />
                              <span className="text-[10px] text-base-content/40 capitalize">{s === "active" ? "resident" : s}</span>
                              {i < 2 && <div className={`w-4 h-0.5 ${done && currentIdx > i ? "bg-success" : "bg-base-300"}`} />}
                            </div>
                          );
                        })}
                      </div>

                      <p className={`text-sm font-semibold ${
                        myBooking.status === "pending" ? "text-warning" :
                        myBooking.status === "active" ? "text-success" :
                        myBooking.status === "rejected" ? "text-error" :
                        "text-primary"
                      }`}>
                        {myBooking.status === "pending" && "Booking Request Pending"}
                        {myBooking.status === "approved" && "Booking Approved — Move In!"}
                        {myBooking.status === "active" && "You are a resident here"}
                        {myBooking.status === "rejected" && "Booking Request Declined"}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {myBooking.roomType} · ₹{myBooking.monthlyRent?.toLocaleString("en-IN")}/mo
                      </p>
                      {myBooking.assignedRoom && (
                        <p className="text-xs text-base-content/60">Room {myBooking.assignedRoom}{myBooking.assignedBed ? ` · Bed ${myBooking.assignedBed}` : ""}</p>
                      )}
                      {myBooking.ownerNote && myBooking.status !== "pending" && (
                        <div className="rounded-lg bg-base-200/50 p-2">
                          <p className="text-xs text-base-content/70 italic">&ldquo;{myBooking.ownerNote}&rdquo;</p>
                        </div>
                      )}
                      {myBooking.status === "pending" && (
                        <div className="space-y-1">
                          <p className="text-xs text-base-content/40">
                            Waiting for the PG owner to review your request
                          </p>
                          <button
                            onClick={() => cancelBooking(myBooking._id, {
                              onSuccess: () => toast.success("Booking request cancelled"),
                              onError: (err) => toast.error(err.response?.data?.message || "Failed to cancel"),
                            })}
                            disabled={isCancelling}
                            className="btn btn-xs btn-ghost text-error gap-1"
                          >
                            {isCancelling ? <span className="loading loading-spinner loading-xs" /> : <X className="size-3" />}
                            Cancel Request
                          </button>
                        </div>
                      )}
                      {myBooking.status === "active" && (
                        <button
                          className="btn btn-sm btn-ghost gap-1 text-primary"
                          onClick={() => navigate("/my-pg")}
                        >
                          Go to My PG →
                        </button>
                      )}
                      {myBooking.status === "rejected" && (
                        <div className="space-y-1.5">
                          {myBooking.ownerNote && (
                            <p className="text-xs text-base-content/50">Reason: {myBooking.ownerNote}</p>
                          )}
                          <button
                            className="btn btn-xs btn-primary gap-1"
                            onClick={() => setShowPgBookingModal(true)}
                          >
                            Re-apply
                          </button>
                          {postData?.author?.phone && (
                            <a
                              href={`https://wa.me/${postData.author.phone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent("Hi, I'd like to discuss my PG booking request.")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn btn-xs btn-ghost text-green-600 gap-1"
                            >
                              Contact Owner
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {!isOwner && !isPgPost && !myOffer && (
                    <button
                      className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary transition-colors flex items-center justify-center gap-2"
                      onClick={() => setOfferModal({ mode: "offer" })}
                    >
                      <TrendingUp className="size-5" />
                      Make an Offer
                    </button>
                  )}

                  <VisitScheduler post={postData} authUser={authUser} isOwner={isOwner} />


                  {!isOwner && myOffer && ["pending", "countered"].includes(myOffer.status) && (
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-4">
                      <p className="text-sm font-semibold text-primary">
                        Your offer: {formatMoney(myOffer.currentPrice)}
                      </p>
                      <p className="mt-0.5 text-xs text-primary">
                        {String(myOffer.lastActionBy) === String(authUser?._id)
                          ? "Waiting for the owner to respond"
                          : "The owner sent you a counter — respond below"}
                      </p>
                      {String(myOffer.lastActionBy) !== String(authUser?._id) && (
                        <div className="mt-3 flex gap-2">
                          <button
                            className="flex-1 rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success"
                            onClick={() => respondToOffer({ offerId: myOffer._id, action: "accept" })}
                            disabled={isRespondPending}
                          >
                            Accept {formatMoney(myOffer.currentPrice)}
                          </button>
                          <button
                            className="flex-1 rounded-lg border border-primary/30 bg-base-100 px-3 py-2 text-xs font-semibold text-primary hover:bg-primary/10"
                            onClick={() => setOfferModal({ mode: "counter", offerId: myOffer._id })}
                          >
                            Counter
                          </button>
                        </div>
                      )}
                      <button
                        className="mt-2 w-full text-center text-xs font-medium text-error hover:text-error"
                        onClick={() => respondToOffer({ offerId: myOffer._id, action: "decline" })}
                        disabled={isRespondPending}
                      >
                        Withdraw offer
                      </button>
                    </div>
                  )}

                  {!isOwner && myOffer?.status === "accepted" && (
                    <div className="rounded-xl border border-success/30 bg-success/10 p-4">
                      <p className="text-sm font-semibold text-success">
                        Offer accepted at {formatMoney(myOffer.currentPrice)}!
                      </p>
                      <Link
                        to={`/marketplace?section=chat&userId=${postData.author?._id}`}
                        className="mt-0.5 block text-xs font-medium text-success underline hover:text-success"
                      >
                        Check your Messages to connect and continue.
                      </Link>
                      {!myOffer.reviewedByMe && !reviewedOfferIds.includes(myOffer._id) && (
                        <button
                          className="mt-3 w-full rounded-lg bg-success px-3 py-2 text-xs font-semibold text-white hover:bg-success"
                          onClick={() => setReviewModal({ offerId: myOffer._id, revieweeName: postData.author?.fullName })}
                        >
                          Leave a review
                        </button>
                      )}
                    </div>
                  )}

                  {!isOwner && myOffer && ["declined", "withdrawn"].includes(myOffer.status) && (
                    <button
                      className="w-full py-3 px-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary transition-colors flex items-center justify-center gap-2"
                      onClick={() => setOfferModal({ mode: "offer" })}
                    >
                      <TrendingUp className="size-5" />
                      Make a New Offer
                    </button>
                  )}

                  {!isOwner && (
                    <button
                      className="w-full py-3 px-4 bg-base-100 text-error border border-base-300 font-semibold rounded-xl hover:bg-error/10 transition-colors flex items-center justify-center gap-2"
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
        postUrl={postData ? `${window.location.origin}/p/${postData._id}` : ""}
        postTitle={postData?.title || "Property"}
        postId={postData?._id}
        postImage={media[0] || ""}
      />

      <AmenitiesModal
        open={showAmenitiesModal}
        onClose={() => setShowAmenitiesModal(false)}
        items={amenitiesData}
        radiusKm={amenitiesRadiusKm}
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

      <OfferModal
        isOpen={Boolean(offerModal)}
        mode={offerModal?.mode}
        listedPrice={postData.price}
        currentPrice={offerModal?.mode === "counter" ? myOffer?.currentPrice || postData.price : ""}
        isPending={isOfferPending || isRespondPending}
        onCancel={() => setOfferModal(null)}
        onSubmit={({ price, message }) => {
          if (offerModal?.mode === "counter") {
            respondToOffer({ offerId: offerModal.offerId, action: "counter", price, message });
          } else {
            submitOffer({ price, message });
          }
        }}
      />

      <ReviewModal
        isOpen={Boolean(reviewModal)}
        revieweeName={reviewModal?.revieweeName}
        isPending={isReviewPending}
        onCancel={() => setReviewModal(null)}
        onSubmit={({ rating, comment }) => submitReview({ offerId: reviewModal.offerId, rating, comment })}
      />

      <BoostPropertyModal
        isOpen={showBoostModal}
        post={postData}
        onClose={() => setShowBoostModal(false)}
      />

      <VerifyAddressModal
        isOpen={showVerifyModal}
        post={postData}
        onClose={() => setShowVerifyModal(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["propertyPost", id] });
        }}
      />

      {isPgPost && (
        <PgBookingModal
          isOpen={showPgBookingModal}
          pgPost={postData}
          onClose={() => setShowPgBookingModal(false)}
          onSuccess={() => {
            setShowPgBookingModal(false);
            queryClient.invalidateQueries({ queryKey: ["propertyPost", id] });
          }}
        />
      )}
    </AppShell>
  );
}

function PgBookingModal({ isOpen, pgPost, onClose, onSuccess }) {
  const pgMeta = pgPost?.postMeta?.pgHostel || {};
  const sharingTypes = pgMeta.sharingTypes || [];
  const houseRules = pgMeta.houseRules || [];

  const [step, setStep] = useState(1);
  const [selectedRoom, setSelectedRoom] = useState(sharingTypes[0]?.type || "");
  const [moveInDate, setMoveInDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [message, setMessage] = useState("");
  const [rulesAccepted, setRulesAccepted] = useState(false);
  const { mutate: requestBooking, isPending } = useRequestBooking();

  const selectedSharing = sharingTypes.find((s) => s.type === selectedRoom);
  const monthlyRent = selectedSharing?.price || 0;
  const depositAmount = pgMeta.securityDeposit || monthlyRent * 2;
  const totalMoveIn = monthlyRent + depositAmount;

  function handleSubmit(e) {
    e.preventDefault();
    if (houseRules.length > 0 && !rulesAccepted) {
      toast.error("Please accept the house rules to proceed");
      return;
    }
    requestBooking(
      {
        pgId: pgPost._id,
        roomType: selectedRoom,
        preferredMoveInDate: new Date(moveInDate).toISOString(),
        monthlyRent,
        depositAmount,
        message: message.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Booking request sent! The PG owner will review it.");
          setStep(1);
          setRulesAccepted(false);
          onSuccess?.();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || "Failed to send request");
        },
      }
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-base-100 rounded-2xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-base-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold">Book This PG</h3>
            <div className="flex items-center gap-2 mt-1">
              <div className={`h-1 rounded-full flex-1 ${step >= 1 ? "bg-primary" : "bg-base-300"}`} />
              <div className={`h-1 rounded-full flex-1 ${step >= 2 ? "bg-primary" : "bg-base-300"}`} />
            </div>
          </div>
          <button onClick={() => { setStep(1); onClose(); }} className="btn btn-sm btn-ghost btn-circle">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {step === 1 && (
            <div className="p-6 space-y-5">
              <div>
                <h4 className="text-xs font-semibold text-base-content/60 uppercase tracking-wider mb-3">Step 1 — Select Room Type</h4>
                <div className="space-y-2">
                  {sharingTypes.map((st) => (
                    <label
                      key={st.type}
                      className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedRoom === st.type
                          ? "border-primary bg-primary/5"
                          : "border-base-200 hover:border-base-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="roomType"
                          value={st.type}
                          checked={selectedRoom === st.type}
                          onChange={() => setSelectedRoom(st.type)}
                          className="radio radio-primary radio-sm"
                        />
                        <div>
                          <p className="font-medium text-sm">{st.type} Sharing</p>
                          <p className="text-xs text-base-content/50">Per person / month</p>
                        </div>
                      </div>
                      <span className="font-bold text-primary">₹{st.price?.toLocaleString("en-IN")}</span>
                    </label>
                  ))}
                  {sharingTypes.length === 0 && (
                    <p className="text-sm text-base-content/50 text-center py-4">No room types listed</p>
                  )}
                </div>
              </div>

              {selectedRoom && (
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-1.5">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider">Cost Summary</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Monthly Rent ({selectedRoom})</span>
                    <span className="font-semibold">₹{monthlyRent.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Security Deposit</span>
                    <span className="font-semibold">₹{depositAmount.toLocaleString("en-IN")}</span>
                  </div>
                  {pgMeta.lockInPeriodMonths > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/60">Lock-in Period</span>
                      <span className="font-semibold">{pgMeta.lockInPeriodMonths} months</span>
                    </div>
                  )}
                  {pgMeta.foodIncluded && (
                    <div className="flex justify-between text-sm">
                      <span className="text-base-content/60">Food</span>
                      <span className="font-semibold text-green-600">Included</span>
                    </div>
                  )}
                  <div className="border-t border-primary/20 pt-2 flex justify-between text-sm font-bold">
                    <span>Total Due at Move-in</span>
                    <span className="text-primary">₹{totalMoveIn.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              )}

              <button
                type="button"
                disabled={!selectedRoom}
                className="btn btn-primary w-full"
                onClick={() => setStep(2)}
              >
                Continue
              </button>
            </div>
          )}

          {step === 2 && (
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <button type="button" onClick={() => setStep(1)} className="btn btn-ghost btn-xs gap-1 -ml-1 mb-1">
                ← Back to room selection
              </button>

              <div>
                <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider block mb-2">
                  Preferred Move-in Date
                </label>
                <input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className="input input-bordered input-sm w-full"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/60 uppercase tracking-wider block mb-2">
                  Message to Owner <span className="text-base-content/30">(optional)</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Introduce yourself, mention your occupation, duration of stay..."
                  rows={3}
                  maxLength={500}
                  className="textarea textarea-bordered textarea-sm w-full"
                />
              </div>

              {houseRules.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} />
                    House Rules
                  </p>
                  <ul className="space-y-1.5">
                    {houseRules.map((rule, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-base-content/70">
                        <span className="mt-0.5 w-4 h-4 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 text-[10px] font-bold text-amber-700 dark:text-amber-400">{i + 1}</span>
                        {rule}
                      </li>
                    ))}
                  </ul>
                  <label className="flex items-center gap-2 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm checkbox-warning"
                      checked={rulesAccepted}
                      onChange={(e) => setRulesAccepted(e.target.checked)}
                    />
                    <span className="text-xs font-medium">I accept the house rules</span>
                  </label>
                </div>
              )}

              <div className="rounded-xl bg-base-200/60 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">{selectedRoom} Sharing (Monthly)</span>
                  <span className="font-semibold">₹{monthlyRent.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Security Deposit</span>
                  <span className="font-semibold">₹{depositAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="border-t border-base-300 pt-2 flex justify-between text-sm font-bold">
                  <span>Total Due at Move-in</span>
                  <span className="text-primary">₹{totalMoveIn.toLocaleString("en-IN")}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isPending || !selectedRoom || (houseRules.length > 0 && !rulesAccepted)}
                className="btn btn-primary w-full gap-2"
              >
                <CheckCircle2 size={18} />
                {isPending ? "Sending..." : "Send Booking Request"}
              </button>

              <p className="text-xs text-base-content/40 text-center">
                The PG owner will review your request and confirm availability.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
