import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
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
  Star,
  TrendingUp,
  UserRoundPlus,
  Users,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import ShareModal from "../components/ShareModal";
import ReportPostModal from "../components/ReportPostModal";
import OfferModal from "../components/OfferModal";
import VisitScheduler from "../components/VisitScheduler";
import OfferHistoryTimeline from "../components/OfferHistoryTimeline";
import PriceHistoryChart from "../components/PriceHistoryChart";
import ListingPerformance from "../components/ListingPerformance";
import ReviewModal from "../components/ReviewModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import { getSellerTrustSignals } from "../lib/trustSignals";
import { getPropertySignals, toneClass } from "../lib/propertySignalBadges";
import SimilarProperties from "../components/SimilarProperties";
import axiosInstance from "../lib/axios";
import AppShell from "../components/AppShell";
import { addRecentlyViewed } from "../utils/recentlyViewed";
import { notePropertyView } from "../hooks/usePreferencePrompt";

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

const AMENITY_TYPE_META = {
  schools: { emoji: "🏫", label: "Schools" },
  hospitals: { emoji: "🏥", label: "Hospitals" },
  metro: { emoji: "🚇", label: "Metro Stations" },
  malls: { emoji: "🏬", label: "Malls" },
};

function Section({ title, icon: Icon, children }) {
  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6 md:p-8">
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

function SpecCard({ icon: Icon, value, label, tone }) {
  return (
    <div className={`rounded-xl p-5 text-center transition-colors ${tone}`}>
      {Icon ? <Icon className="size-6 mx-auto mb-2" /> : null}
      <p className="text-sm font-bold text-base-content truncate">{value}</p>
      <p className="text-xs text-base-content/70">{label}</p>
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
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [offerModal, setOfferModal] = useState(null); // { mode: "offer" | "counter", offerId? }
  const [reviewModal, setReviewModal] = useState(null); // { offerId, revieweeName }
  const [reviewedOfferIds, setReviewedOfferIds] = useState([]);

  const { data: authData } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      const response = await axiosInstance.get("/auth/verify", { skipErrorToast: true });
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
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
    refetchInterval: 6000,
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
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyPost", id], context.previousPost);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyPost", id] });
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
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
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyPost", id], context.previousPost);
    },
    onSettled: () => {
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
    refetchInterval: 6000,
  });

  // Owner's incoming offers on this post.
  const { data: postOffers = [] } = useQuery({
    queryKey: ["postOffers", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/offers/posts/${id}/offers`);
      return res.data?.data?.offers || [];
    },
    enabled: Boolean(id && isOwnerForQueries),
    refetchInterval: 6000,
  });

  const invalidateOfferQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["myOffer", id] });
    queryClient.invalidateQueries({ queryKey: ["postOffers", id] });
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
      axiosInstance.post(`/posts/${id}/view`).catch(() => {
        // Non-critical — view count is best-effort.
      });
      notePropertyView(); // feeds the progressive-onboarding "shown enough listings" gate
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
    postData.bedrooms ? { icon: Bed, value: postData.bedrooms, label: "Bedrooms", tone: "bg-primary/10 text-primary" } : null,
    postData.bathrooms ? { icon: Bath, value: postData.bathrooms, label: "Bathrooms", tone: "bg-info/10 text-info" } : null,
    postData.areaSqft ? { icon: Ruler, value: `${Number(postData.areaSqft).toLocaleString("en-IN")} sq.ft`, label: "Area", tone: "bg-success/10 text-success" } : null,
    postData.propertyType ? { icon: Building2, value: postData.propertyType, label: "Type", tone: "bg-warning/10 text-warning" } : null,
    furnishing ? { icon: Home, value: titleCase(furnishing), label: "Furnishing", tone: "bg-secondary/10 text-secondary" } : null,
    hasParking ? { icon: Car, value: "Available", label: "Parking", tone: "bg-success/10 text-success" } : null,
    possession ? { icon: Clock, value: possession, label: "Possession", tone: "bg-error/10 text-error" } : null,
    facing ? { icon: Compass, value: facing, label: "Facing", tone: "bg-base-200 text-base-content/70" } : null,
    floorNumber ? { icon: Layers, value: totalFloors ? `${floorNumber} of ${totalFloors}` : `Floor ${floorNumber}`, label: "Floor", tone: "bg-info/10 text-info" } : null,
    ageOfProperty ? { icon: Calendar, value: ageOfProperty, label: "Age", tone: "bg-warning/10 text-warning" } : null,
  ].filter(Boolean);

  const amenitiesData = amenitiesResult?.items || [];
  const amenitiesRadiusKm = ((amenitiesResult?.radius || 2000) / 1000).toFixed(amenitiesResult?.radius % 1000 ? 1 : 0);

  const publishedDiffersFromCreated = postData.publishedAt && postData.createdAt &&
    new Date(postData.publishedAt).getTime() !== new Date(postData.createdAt).getTime();
  const wasEdited = postData.updatedAt && postData.createdAt &&
    new Date(postData.updatedAt).getTime() - new Date(postData.createdAt).getTime() > 60000;

  return (
    <AppShell hideHero>
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
                      <h1 className="text-3xl md:text-4xl font-bold text-base-content">{postData.title || "Property Listing"}</h1>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${postData.status === "PUBLISHED" ? "bg-success/15 text-success" : "bg-base-200 text-base-content/70"}`}>
                        {titleCase(postData.status) || "Active"}
                      </span>
                      {postData.visibility === "PRIVATE" && (
                        <span className="rounded-full bg-neutral px-3 py-1 text-xs font-semibold text-white">Private</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-base-content/70 flex-wrap">
                      <MapPin className="size-5 text-primary" />
                      <span className="text-lg">
                        {[postData.locality, postData.city].filter(Boolean).join(", ") || "Location not specified"}
                      </span>
                      {latitude && longitude && (
                        <button
                          type="button"
                          onClick={() => navigate(`/map-view?propertyId=${postData._id}`)}
                          className="flex items-center gap-1 text-primary text-sm hover:underline"
                        >
                          <span className="size-2 rounded-full bg-primary"></span>
                          <span>Live Location</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="rounded-full bg-base-200 px-2.5 py-1 text-xs font-medium text-base-content/70">
                        {titleCase(postData.postType)}
                      </span>
                      {isOwner && (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          Your listing
                        </span>
                      )}
                    </div>
                    {allSignalBadges.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {allSignalBadges.map((s) => (
                          <span key={s.key} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneClass(s.tone)}`}>
                            {s.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl md:text-4xl font-bold text-primary">{formatMoney(postData.price)}</p>
                    <p className="text-sm text-base-content/60 mt-1">Posted {relativeDate(postData.createdAt)}</p>
                    {wasEdited && <p className="text-xs text-base-content/50">Edited {relativeDate(postData.updatedAt)}</p>}
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

              {/* Listing performance — owner only */}
              {isOwner && !postData.isDeleted && (
                <div className="mt-4">
                  <ListingPerformance post={postData} />
                </div>
              )}

              {/* Offers Received — owner only */}
              {isOwner && postOffers.length > 0 && (
                <Section title="Offers Received" icon={TrendingUp}>
                  <div className="space-y-3">
                    {postOffers.map((offer) => {
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
                </Section>
              )}

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
                      <div key={idx} className="flex items-center gap-3 bg-base-200 hover:bg-base-200 px-4 py-3 rounded-xl text-sm text-base-content transition-colors">
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0"></span>
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

              {/* Price History */}
              {postData.priceHistory?.length > 1 && (
                <Section title="Price History" icon={TrendingUp}>
                  <PriceHistoryChart history={postData.priceHistory} />
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

                  <h3 className="text-lg font-semibold text-base-content mb-4">Nearby Amenities</h3>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {amenitiesData.slice(0, 8).map((amenity) => (
                        <div key={amenity.id} className="flex items-center gap-3 p-3 bg-base-200 rounded-lg">
                          <span className="text-lg">{AMENITY_TYPE_META[amenity.type]?.emoji || "📍"}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-base-content truncate">{amenity.name}</p>
                            <p className="text-xs text-base-content/60">
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
                          <img src={postData.author.profilePic} alt={postData.author.fullName} className="w-full h-full rounded-full object-cover" />
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
                        {postData.author?.isVerified && (
                          <BadgeCheck className="size-5 text-primary flex-shrink-0" />
                        )}
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
                  <button
                    className="w-full py-3 px-4 bg-base-100 text-base-content border border-base-300 font-semibold rounded-xl hover:bg-base-200 transition-colors flex items-center justify-center gap-2"
                    onClick={() => setShowShareModal(true)}
                  >
                    <Share2 className="size-5" />
                    Share
                  </button>

                  {!isOwner && !myOffer && (
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
    </AppShell>
  );
}
