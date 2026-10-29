import React, { useEffect, useMemo, useRef, useState, useCallback, Suspense } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Compass,
  Edit3,
  Eye,
  Filter,
  Flag,
  Flame,
  Handshake,
  Heart,
  HelpCircle,
  Home,
  IndianRupee,
  Loader2,
  LocateFixed,
  Map,
  MapPin,
  Navigation,
  Newspaper,
  Target,
  Maximize,
  MessageCircle,
  MoreVertical,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  ThumbsDown,
  TrendingUp,
  Upload,
  UserCircle,
  UserRoundPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
const BoostPropertyModal = React.lazy(() => import("../components/BoostPropertyModal"));
const ShareModal = React.lazy(() => import("../components/ShareModal"));
const PostLikesModal = React.lazy(() => import("../components/PostLikesModal"));
import PropertyPostCard from "../components/PropertyPostCard";
import ClampedCaption from "../components/ClampedCaption";
import CompareToggleButton from "../components/CompareToggleButton";
import CompareFloatingBar from "../components/CompareFloatingBar";
const FullscreenMediaViewer = React.lazy(() => import("../components/FullscreenMediaViewer"));
import ScrollTopButton from "../components/ScrollTopButton";
import { useScrollRestoration } from "../hooks/useScrollRestoration";
import { getCuratedCardBadges, getPropertyInfoBadges } from "../lib/propertyDetailBadges";
const VerifyAddressModal = React.lazy(() => import("../components/VerifyAddressModal"));
import { getPriceContextBadges } from "../lib/priceContextBadges";
import PreferencePrompt from "../components/PreferencePrompt";
import LocationPrompt from "../components/LocationPrompt";
import { trackRecoEvent } from "../lib/recoEvents";
import FeedSuggestionCard from "../components/FeedSuggestionCard";
import AdCard from "../components/AdCard";
import PostTypeFields from "../components/PostTypeFields";
import PriceSuggestion from "../components/PriceSuggestion";
import { getPostTypeConfig } from "../config/postTypeConfig";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { useLiveLocation } from "../hooks/useLiveLocation";
import { toggleCompareSelection } from "../lib/compareSelection";
const ReportPostModal = React.lazy(() => import("../components/ReportPostModal"));
import { getCustomBadgeClasses } from "../lib/badgeColors";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import CommentSection from "../components/CommentSection";
const ChatContent = React.lazy(() => import("../components/ChatContent"));
const ConnectionsContent = React.lazy(() => import("../components/ConnectionsContent"));
const CallContent = React.lazy(() => import("../components/CallContent"));
const LazyLocationPicker = React.lazy(() => import("../components/LocationPickerMap"));
const ProfileContent = React.lazy(() => import("../components/ProfileContent"));
const ConfirmDeleteModal = React.lazy(() => import("../components/ConfirmDeleteModal"));
const ActivityContent = React.lazy(() => import("../components/ActivityContent"));
const CommunitiesContent = React.lazy(() => import("../components/CommunitiesContent"));
const CommunityChat = React.lazy(() => import("../components/CommunityChat"));
import RoleBasedPropertyCard from "../components/RoleBasedPropertyCard";
import RoleBasedFilters from "../components/RoleBasedFilters";
import StoriesBar from "../components/StoriesBar";
const RoleBasedDashboard = React.lazy(() => import("../components/RoleBasedDashboard"));
import axiosInstance from "../lib/axios";
import { useFriends } from "../hooks/useFriends";
import { uploadPropertyMedia } from "../lib/cloudinaryUpload";
import { getAutoDetectedCity, reverseGeocode } from "../utils/geolocation";
import posthog, { isPostHogEnabled } from "../lib/posthog";

const DEFAULT_MAP_CENTER = [20.5937, 78.9629]; // geographic center of India, used until a location is picked

const LEFT_NAV_ITEMS = [
  { label: "Marketplace", icon: Home, section: "marketplace" },
  { label: "Map View", icon: Map, section: "map" },
  { label: "Communities", icon: Users, section: "communities" },
  { label: "Messages", icon: MessageCircle, section: "chat" },
  { label: "Connections", icon: Users, section: "connections" },
  { label: "Calls", icon: Phone, section: "call" },
  { label: "Edit Profile", icon: UserCircle, section: "profile" },
];

const ADMIN_NAV_ITEM = { label: "Admin", icon: ShieldCheck, section: "admin" };

const STORY_COLLECTIONS = [
  { label: "Premium Projects", category: "For You", image: "https://placehold.co/480x320?text=Premium+Projects" },
  { label: "Luxury Homes", category: "Luxury", image: "https://placehold.co/480x320?text=Luxury+Homes" },
  { label: "New Launches", category: "Recent", image: "https://placehold.co/480x320?text=New+Launches" },
  { label: "Verified Brokers", category: "Verified", image: "https://placehold.co/480x320?text=Verified+Brokers" },
  { label: "Agricultural", category: "Agricultural", image: "https://placehold.co/480x320?text=Agricultural" },
  { label: "Commercial", category: "Commercial", image: "https://placehold.co/480x320?text=Commercial" },
  { label: "Investment", category: "Investment", image: "https://placehold.co/480x320?text=Investment" },
  { label: "Trending", category: "Recent", image: "https://placehold.co/480x320?text=Trending" },
];

const CATEGORY_CHIPS = ["For You", "Following", "Near Me"];

const LISTING_TYPES = ["All", "Sell", "Rent", "Requirement", "Project", "Commercial", "Agricultural Land"];
const PROPERTY_TYPES = ["All", "Apartment", "Independent House", "Villa", "Plot", "Commercial", "Agricultural Land"];
const CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Indore",
  "Bhopal",
  "Nagpur",
  "Surat",
  "Other",
];

const ROLE_RECOMMENDED_OPTIONS = {
  Buyer: ["REQUIREMENT_BUY"],
  Tenant: ["REQUIREMENT_RENT", "FLATMATE_SEEKING", "FLATMATE_OFFER"],
  Student: ["FLATMATE_SEEKING", "FLATMATE_OFFER", "REQUIREMENT_RENT"],
  Seller: ["PROPERTY_SALE"],
  Landlord: ["PROPERTY_RENT"],
  Broker: ["PROPERTY_SALE", "PROPERTY_RENT", "REQUIREMENT_BUY", "REQUIREMENT_RENT"],
  Builder: ["BUILDER_PROJECT"],
};

const COMPOSER_STEPS = ["type", "details", "photos", "review"];

const POST_TYPE_DEFINITIONS = {
  PROPERTY_SALE: {
    label: "List Property for Sale",
    description: "Create an immersive sale listing",
    listingType: "Sell",
    propertyType: "Apartment",
  },
  PROPERTY_RENT: {
    label: "List Property for Rent",
    description: "Post a rental opportunity",
    listingType: "Rent",
    propertyType: "Apartment",
  },
  REQUIREMENT_BUY: {
    label: "Requirement to Buy",
    description: "Tell sellers what you are looking for",
    listingType: "Buy",
    propertyType: "Apartment",
  },
  REQUIREMENT_RENT: {
    label: "Looking for Rental Property",
    description: "Publish tenant requirements",
    listingType: "Rent",
    propertyType: "Apartment",
  },
  COMMERCIAL_LISTING: {
    label: "Commercial Listing",
    description: "List office, shop, or warehouse",
    listingType: "Sell",
    propertyType: "Commercial",
  },
  AGRICULTURAL_LISTING: {
    label: "Agricultural Land Listing",
    description: "Post farm and land opportunities",
    listingType: "Sell",
    propertyType: "Agricultural Land",
  },
  BUILDER_PROJECT: {
    label: "Builder Project",
    description: "Launch and promote a project",
    listingType: "Project",
    propertyType: "Apartment",
  },
  INVESTMENT_OPPORTUNITY: {
    label: "Investment Opportunity",
    description: "Share high-growth investment inventory",
    listingType: "Sell",
    propertyType: "Commercial",
  },
  OPEN_HOUSE_EVENT: {
    label: "Open House Event",
    description: "Promote scheduled visits",
    listingType: "Event",
    propertyType: "Apartment",
  },
  FLATMATE_OFFER: {
    label: "Room Available",
    description: "Offer a room or bed to flatmates",
    listingType: "Rent",
    propertyType: "Apartment",
  },
  FLATMATE_SEEKING: {
    label: "Looking for Room / Flatmates",
    description: "Find a room or team up with flatmates",
    listingType: "Rent",
    propertyType: "Apartment",
  },
};

const ALL_CREATE_POST_TYPES = [
  "PROPERTY_SALE",
  "PROPERTY_RENT",
  "REQUIREMENT_BUY",
  "REQUIREMENT_RENT",
  "COMMERCIAL_LISTING",
  "AGRICULTURAL_LISTING",
  "BUILDER_PROJECT",
  "INVESTMENT_OPPORTUNITY",
  "OPEN_HOUSE_EVENT",
  "FLATMATE_OFFER",
  "FLATMATE_SEEKING",
];

function relativeTimeShort(when) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Distance pill for a post in "Near Me" — colour tracks proximity (same
// bands the server ranks by), `~` marks a city-centroid approximation.
function distancePill(post) {
  if (typeof post.distanceKm !== "number") return null;
  const km = post.distanceKm;
  const approx = post.locationPrecision === "approx";
  const prefix = approx ? "~" : "";
  const dist = km < 1 ? `${Math.round(km * 1000)} m` : `${km} km`;

  let label = `${prefix}${dist} away`;
  let className = "bg-slate-100 text-slate-600";
  if (km <= 1 && !approx) {
    label = "In your area";
    className = "bg-emerald-600 text-white";
  } else if (km <= 3) {
    className = "bg-emerald-100 text-emerald-700";
  } else if (km <= 10) {
    className = "bg-primary/10 text-primary";
  } else if (km <= 25) {
    className = "bg-amber-100 text-amber-700";
  }
  return { label, className };
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeMedia(post) {
  return Array.isArray(post.mediaUrls) && post.mediaUrls.length
    ? post.mediaUrls
    : ["https://placehold.co/1400x900?text=NearMySpace+Listing"];
}

function isVideoUrl(url) {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  return videoExtensions.some((ext) => String(url).toLowerCase().endsWith(ext));
}

function getListingBadge(post) {
  // Takes priority over everything else — once a deal is closed, that's
  // more important and more accurate than any other badge text.
  if (post.offerStatus === "ACCEPTED") {
    const postType = String(post.postType || "").toUpperCase();
    return postType === "PROPERTY_RENT" || post.listingType?.toLowerCase() === "rent" ? "Rented" : "Sold";
  }
  if (post.customBadge) return post.customBadge;
  const postType = String(post.postType || "").toUpperCase();
  if (postType === "PROPERTY_SALE") return "For Sale";
  if (postType === "PROPERTY_RENT") return "For Rent";
  if (postType === "REQUIREMENT_BUY") return "Looking to Buy";
  if (postType === "REQUIREMENT_RENT") return "Looking for Rent/PG";
  if (postType === "BUILDER_PROJECT") return "Project";
  if (postType === "INVESTMENT_OPPORTUNITY") return "Investment";
  if (postType === "OPEN_HOUSE_EVENT") return "Open House";
  if (postType === "FLATMATE_OFFER") return "Room Available";
  if (postType === "FLATMATE_SEEKING") return "Looking for Room";
  // Commercial / agricultural can be either sale or rent — derive from
  // listingType instead of falling through to the raw "Sell" string.
  if (postType === "AGRICULTURAL_LISTING") {
    return String(post.listingType || "").toLowerCase() === "rent" ? "Land for Lease" : "Land for Sale";
  }
  if (postType === "COMMERCIAL_LISTING") {
    return String(post.listingType || "").toLowerCase() === "rent" ? "For Rent" : "For Sale";
  }
  const listing = String(post.listingType || "").toLowerCase();
  if (listing === "sell") return "For Sale";
  if (listing === "rent") return "For Rent";
  if (post.listingType) return post.listingType;
  if (Number(post.price || 0) > 30000000) return "Luxury";
  return "Featured";
}

export default function MarketplacePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const activeRoleRaw = String(authUser?.activeRole || authUser?.primaryRole || "Buyer");
  const activeRole = activeRoleRaw.charAt(0).toUpperCase() + activeRoleRaw.slice(1).toLowerCase();
  const recommendedPostTypes = useMemo(
    () => ROLE_RECOMMENDED_OPTIONS[activeRole] || ["PROPERTY_SALE"],
    [activeRole]
  );
  const availablePostTypes = ALL_CREATE_POST_TYPES;

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [searchType, setSearchType] = useState(null);
  const [searchAuthorId, setSearchAuthorId] = useState(null);
  const [activeNaturalParsed, setActiveNaturalParsed] = useState(null);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [selectedTrendingLocation, setSelectedTrendingLocation] = useState(null);
  const [activeBadgeFilter, setActiveBadgeFilter] = useState(null);

  const handleFilterByBadge = (badge, e) => {
    if (e) e.stopPropagation();
    const val = badge?.filterValue || badge?.label || "";
    if (!val) return;

    if (activeBadgeFilter === val) {
      setActiveBadgeFilter(null);
      setSearch("");
    } else {
      setActiveBadgeFilter(val);
      setSearch(val);
    }
  };

  useEffect(() => {
    if (!search && activeBadgeFilter) {
      setActiveBadgeFilter(null);
    }
  }, [search, activeBadgeFilter]);
  const [likedBurstPostId, setLikedBurstPostId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [likesModalPostId, setLikesModalPostId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [selectedPostForContact, setSelectedPostForContact] = useState(null);
  const contactMessageRef = useRef(null);
  const [activeSection, setActiveSection] = useState(() => {
    const sectionParam = searchParams.get("section");
    return sectionParam || "marketplace";
  });

  // Keep activeSection in sync with the URL. The shared bottom nav (and any
  // other page) navigates here via <Link to="/marketplace?section=X">, which
  // updates searchParams without remounting this component — without this
  // effect, the one-time useState initializer above would never see it.
  useEffect(() => {
    const sectionParam = searchParams.get("section") || "marketplace";
    setActiveSection((prev) => (prev === sectionParam ? prev : sectionParam));
  }, [searchParams]);
  const [selectedCommunity, setSelectedCommunity] = useState(null);

  // Deep link from a call-reminder email/push: ?section=communities&circle=<id>&joinCall=1[&callId=<id>].
  // Loads that community and tells CommunityChat to join the call itself,
  // rather than making the member hunt for it after opening the app.
  const deepLinkCircleId = searchParams.get("circle");
  const autoJoinCall = searchParams.get("joinCall") === "1";
  const autoJoinCallId = searchParams.get("callId") || null;
  const { data: deepLinkCircle } = useQuery({
    queryKey: ["deepLinkCircle", deepLinkCircleId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/community/circles/${deepLinkCircleId}`);
      return res.data?.data?.circle || null;
    },
    enabled: Boolean(deepLinkCircleId) && !selectedCommunity,
  });
  useEffect(() => {
    if (!deepLinkCircle || selectedCommunity) return;
    setActiveSection("communities");
    setSelectedCommunity(deepLinkCircle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkCircle]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [dismissedRecs, setDismissedRecs] = useState(() => new Set());
  const [dismissedAds, setDismissedAds] = useState(() => new Set());
  const [postMenuAnchor, setPostMenuAnchor] = useState(null); // { post, top, left }
  const [reportTargetPost, setReportTargetPost] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [boostTargetPost, setBoostTargetPost] = useState(null);
  const [verifyAddressTargetPost, setVerifyAddressTargetPost] = useState(null);

  // Portaled to <body> so the menu escapes the card's own overflow-hidden
  // (needed for the image's rounded corners) — otherwise it gets clipped.
  useEffect(() => {
    if (!postMenuAnchor) return;
    const close = () => setPostMenuAnchor(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [postMenuAnchor]);

  const { data: friendsData } = useFriends({ enabled: !!authUser });

  // Read badge counts from shared cache (AppShell polls this at 15s)
  const { data: badgeCounts = { activityCount: 0, messageRequestCount: 0, friendRequestCount: 0 } } = useQuery({
    queryKey: ["badgeCounts"],
    queryFn: async () => {
      if (!authUser) return { activityCount: 0, messageRequestCount: 0, friendRequestCount: 0 };
      const res = await axiosInstance.get("/notifications/badge-counts");
      return res.data?.data || { activityCount: 0, messageRequestCount: 0, friendRequestCount: 0 };
    },
    enabled: !!authUser,
    staleTime: 30000,
  });

  const activityNotifications = badgeCounts.activityCount;
  const messageRequests = badgeCounts.messageRequestCount;
  const incomingRequestsCount = badgeCounts.friendRequestCount;

  // Total unread count for badges (includes all notification types + friend requests)
  const totalUnreadCount = activityNotifications + messageRequests + incomingRequestsCount;

  // Mark notifications as read when visiting chat, activity, or connections section
  useEffect(() => {
    if ((activeSection === "chat" || activeSection === "activity" || activeSection === "connections") && totalUnreadCount > 0) {
      const markNotificationsAsRead = async () => {
        try {
          await axiosInstance.patch("/notifications/read-all");
          queryClient.invalidateQueries({ queryKey: ["badgeCounts"] });
        } catch (error) {
          console.error("Failed to mark notifications as read:", error);
        }
      };
      markNotificationsAsRead();
    }
  }, [activeSection, totalUnreadCount]);

  // Handle contact click - open chat modal or direct chat if friends
  const handleContactClick = (post) => {
    if (!authUser) {
      toast.error("Please login to contact the owner");
      navigate("/login");
      return;
    }

    // Check if already friends
    const isFriend = friendsData?.some(friend => friend._id === post.author?._id);
    
    if (isFriend) {
      // Open chat directly if already friends
      navigate(`/chat?userId=${post.author?._id}`);
      toast.success("Opening chat with " + (post.author?.fullName?.split(" ")[0] || "owner"));
    } else {
      // Open contact modal if not friends
      setSelectedPostForContact(post);
      setContactModalOpen(true);
    }
  };

  // Send contact message
  const handleSendContactMessage = async (message) => {
    console.log("handleSendContactMessage called with message:", message);
    if (!authUser) {
      console.log("No auth user, returning");
      return;
    }

    try {
      console.log("Sending notification to:", selectedPostForContact?.author?._id);
      console.log("Selected post:", selectedPostForContact);
      
      // Create notification for the property owner
      const response = await axiosInstance.post("/notifications", {
        recipientId: selectedPostForContact?.author?._id,
        type: "message_request",
        message: `${authUser.fullName} is interested in your property: ${selectedPostForContact?.title || "Property"}`,
        actualMessage: message, // Send the actual message content
        propertyPostId: selectedPostForContact?._id,
      });

      console.log("Notification response:", response.data);

      // Invalidate notification queries to update counts
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["badgeCounts"] });

      // TODO: Create actual message/chat entry
      console.log("Sending contact message:", {
        postId: selectedPostForContact?._id,
        recipientId: selectedPostForContact?.author?._id,
        message,
      });

      toast.success("Message sent successfully!");
      setContactModalOpen(false);
      setSelectedPostForContact(null);
    } catch (error) {
      console.error("Error sending contact message:", error);
      console.error("Error details:", error.response?.data);
      toast.error("Failed to send message. Please try again.");
    }
  };


  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters] = useState({
    transactionType: "All",
    propertyType: "All",
    city: "",
    locality: "",
    budgetMin: 0,
    budgetMax: 0, // 0 means unlimited (see maxOk below) — was 150000000, which
    // silently hid every listing priced above ₹15 crore from everyone's
    // default feed with no UI indication a filter was even active.
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const hasActiveMarketplaceFilters =
    appliedFilters.transactionType !== "All" ||
    appliedFilters.propertyType !== "All" ||
    Boolean(appliedFilters.city) ||
    Boolean(appliedFilters.locality) ||
    Number(appliedFilters.budgetMin || 0) > 0 ||
    Number(appliedFilters.budgetMax || 0) > 0;

  const saveSearchFromFilters = async (f) => {
    const t = f.transactionType;
    const postType = t === "Rent" ? ["PROPERTY_RENT"] : t === "Sell" || t === "Buy" ? ["PROPERTY_SALE"] : [];
    const payload = {
      postType,
      city: f.city || "",
      locality: f.locality || "",
      propertyType: f.propertyType && !["All", "Any"].includes(f.propertyType) ? f.propertyType : "",
      minPrice: Number(f.budgetMin || 0) || null,
      maxPrice: Number(f.budgetMax || 0) || null,
    };
    try {
      await axiosInstance.post("/saved-searches", { filters: payload });
      toast.success("Search saved — we'll alert you when new listings match");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Couldn't save this search");
    }
  };

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  // 1-based index into the dynamic `composerSteps` list below — the flow has
  // fewer steps for requirement posts (which skip the photo step).
  const [composerStep, setComposerStep] = useState(1);
  // null while editing; "DRAFT" / "PUBLISHED" once the post is saved, which
  // swaps the wizard body for the success screen.
  const [composerResult, setComposerResult] = useState(null);
  const [showDraftsList, setShowDraftsList] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [draftToDelete, setDraftToDelete] = useState(null);
  const [draft, setDraft] = useState({
    postType: "PROPERTY_SALE",
    listingType: "Sell",
    propertyType: "Apartment",
    title: "",
    caption: "",
    city: authUser?.city || authUser?.homeBase || "",
    locality: "",
    price: "",
    bedrooms: "",
    bathrooms: "",
    areaSqft: "",
    mediaUrls: "",
    mediaFiles: [],
    moveInDate: "",
    availableFromDate: "",
    leaseDurationMonths: "",
    depositAmount: "",
    budgetMin: "",
    budgetMax: "",
    occupancyPreference: "",
    genderPreference: "",
    furnishedPreference: "",
    requirementPropertyType: "",
    parkingRequired: false,
    amenitiesText: "",
    possessionDate: "",
    loanRequired: false,
    tenantType: "",
    occupation: "",
    latitude: null,
    longitude: null,
    reraNumber: "",
    projectName: "",
    launchDate: "",
    brochureUrl: "",
    investmentThesis: "",
    // Agricultural-land + commercial specifics — persisted under
    // postMeta.land / postMeta.commercial (see createPost payload builder).
    landArea: "",
    landAreaUnit: "",
    soilType: "",
    waterAvailability: "",
    roadAccess: false,
    electricityAvailable: false,
    commercialType: "",
    carpetArea: "",
    floorNumber: "",
    washrooms: "",
    // Enhanced residential fields
    furnishing: "",
    facing: "",
    totalFloors: "",
    ageOfProperty: "",
    maintenanceCharges: "",
    houseRules: [],
    spaceType: "",
    preferredTenants: [],
    amenities: [],
    alternativeMobile: "",
    electricityBillUrl: "",
    // Flatmate fields
    roomType: "",
    occupancy: "",
    rentPerPerson: "",
    flatmateDeposit: "",
    availableFrom: "",
    flatmateFurnishing: "",
    flatmateGender: "",
    targetAudience: [],
    lifestyleTags: [],
    amenityTags: [],
    collegeName: "",
    workplaceName: "",
    seekerBudgetMin: "",
    seekerBudgetMax: "",
    preferredLocalities: "",
    groupSize: "",
  });

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [, setLoadingSuggestions] = useState(false);
  const mapRef = useRef(null);
  const geocodeTimeoutRef = useRef(null);

  // Handle position change from map
  const handleMapPositionChange = useCallback((lat, lng) => {
    setDraft(prev => ({ ...prev, latitude: lat, longitude: lng }));
    // Reverse geocode to get city/locality
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)}`;
    fetch(proxyUrl)
      .then(res => res.json())
      .then(data => {
        const city = data.address.city || data.address.town || data.address.village || data.address.municipality || "";
        const locality = data.address.suburb || data.address.neighbourhood || "";
        setDraft(prev => ({
          ...prev,
          city: city || prev.city, // Always update city if we get one
          locality: locality || prev.locality
        }));
      })
      .catch(() => {
        // Silently fail reverse geocoding
      });
  }, []);

  useEffect(() => {
    if (!availablePostTypes.includes(draft.postType)) {
      const nextPostType = recommendedPostTypes[0] || "PROPERTY_SALE";
      const definition = POST_TYPE_DEFINITIONS[nextPostType] || POST_TYPE_DEFINITIONS.PROPERTY_SALE;
      setDraft((prev) => ({
        ...prev,
        postType: nextPostType,
        listingType: definition.listingType,
        propertyType: definition.propertyType,
      }));
    }
  }, [availablePostTypes, draft.postType, recommendedPostTypes]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("openComposer") === "1") {
      setIsComposerOpen(true);
      params.delete("openComposer");
      const nextSearch = params.toString();
      navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  const queryListingType = useMemo(() => {
    if (appliedFilters.transactionType !== "All") return appliedFilters.transactionType;
    if (activeCategory === "Commercial") return "Commercial";
    if (activeCategory === "Agricultural") return "Agricultural Land";
    return null;
  }, [activeCategory, appliedFilters.transactionType]);

  const queryPropertyType = useMemo(() => {
    if (appliedFilters.propertyType !== "All") return appliedFilters.propertyType;
    if (activeCategory === "Commercial") return "Commercial";
    if (activeCategory === "Agricultural") return "Agricultural Land";
    return null;
  }, [activeCategory, appliedFilters.propertyType]);

  const isNearMe = activeCategory === "Near Me";
  const { location: liveLocation, freshness: liveFreshness, status: liveLocStatus, refresh: refreshLocation, checkPermission: checkLocPermission } = useLiveLocation();
  const nearMeCoords = isNearMe && liveLocation?.lat
    ? { lat: liveLocation.lat, lon: liveLocation.lon, accuracy: liveLocation.accuracyMeters }
    : null;

  // Trending Near You — real properties, not a static list, ranked by
  // proximity + how fast they're gaining engagement. A fresh GPS fix (when
  // On opening Near Me: silently re-capture only if the saved fix isn't
  // fresh AND geolocation is already granted. Never prompts on its own —
  // that's what the 📍 button and the "Update location" link are for.
  useEffect(() => {
    if (!isNearMe || liveLocStatus !== "idle" || liveFreshness === "fresh") return;
    let cancelled = false;
    (async () => {
      const perm = await checkLocPermission();
      if (!cancelled && perm === "granted") refreshLocation();
    })();
    return () => { cancelled = true; };
  }, [isNearMe, liveLocStatus, liveFreshness, checkLocPermission, refreshLocation]);

  const [feedRefreshSeed, setFeedRefreshSeed] = useState(0);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: [
      "propertyFeed", activeCategory, search, searchType, searchAuthorId,
      queryListingType || "all", queryPropertyType || "all",
      nearMeCoords ? `${nearMeCoords.lat.toFixed(3)},${nearMeCoords.lon.toFixed(3)}` : "no-geo",
      feedRefreshSeed,
    ],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      if (typeof pageParam === "object" && pageParam !== null) {
        if (pageParam.cursor) params.set("cursor", pageParam.cursor);
        params.set("page", String(pageParam.page || 1));
      } else {
        params.set("page", String(pageParam || 1));
      }
      params.set("limit", "12");
      const pageNum = typeof pageParam === "object" ? (pageParam.page || 1) : (pageParam || 1);
      if (feedRefreshSeed > 0 && pageNum === 1) {
        params.set("refresh", "true");
      }

      // Handle author-specific search vs natural search vs standard query
      const isNaturalQuery = /\b(bhk|bedroom|under|below|less than|near|lakh|lac|cr|crore|rent|between|with|garden|pool|gym)\b/i.test(search.trim());

      let response;
      if (search.trim() && isNaturalQuery && searchType !== 'author') {
        const pageNum = params.get("page") || 1;
        response = await axiosInstance.get(`/search/natural?q=${encodeURIComponent(search.trim())}&page=${pageNum}&limit=12`);
        if (response.data?.data?.parsed) {
          setActiveNaturalParsed(response.data.data.parsed);
        }
      } else {
        if (searchType === 'author' && searchAuthorId) {
          params.set("authorId", searchAuthorId);
        } else if (search.trim()) {
          params.set("q", search.trim());
        }

        if (queryListingType) params.set("listingType", queryListingType);
        if (queryPropertyType) params.set("propertyType", queryPropertyType);

        // Add category filter
        if (activeCategory && activeCategory !== "For You") {
          const categoryMap = {};
          params.set("category", categoryMap[activeCategory] || activeCategory.toLowerCase());
        }

        // Fresh browser location for Near Me — the server prefers this over the
        // saved / city location.
        if (isNearMe && nearMeCoords) {
          params.set("lat", String(nearMeCoords.lat));
          params.set("lon", String(nearMeCoords.lon));
          if (nearMeCoords.accuracy) params.set("accuracy", String(nearMeCoords.accuracy));
        }

        response = await axiosInstance.get(`/posts?${params.toString()}`);
        if (!search.trim()) {
          setActiveNaturalParsed(null);
        }
      }
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      const nextCursor = lastPage?.pagination?.nextCursor;
      const hasMore = lastPage?.pagination?.hasMore ?? (current < total);
      if (!hasMore) return undefined;
      return { page: current + 1, cursor: nextCursor || undefined };
    },
    initialPageParam: { page: 1, cursor: undefined },
    // Only hold the first Near Me fetch if we have NO location at all and one
    // is being captured. With a saved location we query straight away and
    // just re-query when a fresher fix lands (the queryKey carries coords).
    enabled: Boolean(authUser?._id) && !(isNearMe && !liveLocation?.lat && liveLocStatus === "locating"),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  // Determines whether the primary property feed has completed its initial load.
  // Secondary widgets (recommendations, ads, trending, stats, news) are deferred
  // until isFeedLoaded is true so the feed has 100% of the browser's HTTP connections.
  const isFeedLoaded = Boolean(data?.pages?.length);

  // Prefetch next page so it's ready before the user scrolls to the sentinel
  useEffect(() => {
    if (!data?.pages?.length || !hasNextPage) return;
    const lastPage = data.pages[data.pages.length - 1];
    const current = Number(lastPage?.pagination?.page || 1);
    const total = Number(lastPage?.pagination?.totalPages || 1);
    const hasMore = lastPage?.pagination?.hasMore ?? (current < total);
    if (!hasMore) return;
    queryClient.prefetchInfiniteQuery({
      queryKey: [
        "propertyFeed", activeCategory, search, searchType, searchAuthorId,
        queryListingType || "all", queryPropertyType || "all",
        nearMeCoords ? `${nearMeCoords.lat.toFixed(3)},${nearMeCoords.lon.toFixed(3)}` : "no-geo",
        feedRefreshSeed,
      ],
      queryFn: async ({ pageParam }) => {
        const params = new URLSearchParams();
        if (typeof pageParam === "object" && pageParam !== null) {
          if (pageParam.cursor) params.set("cursor", pageParam.cursor);
          params.set("page", String(pageParam.page || 1));
        } else {
          params.set("page", String(pageParam || 1));
        }
        params.set("limit", "12");
        const isNaturalQuery = /\b(bhk|bedroom|under|below|less than|near|lakh|lac|cr|crore|rent|between|with|garden|pool|gym)\b/i.test(search.trim());
        let response;
        if (search.trim() && isNaturalQuery && searchType !== 'author') {
          response = await axiosInstance.get(`/search/natural?q=${encodeURIComponent(search.trim())}&page=${params.get("page") || 1}&limit=12`);
        } else {
          if (searchType === 'author' && searchAuthorId) params.set("authorId", searchAuthorId);
          else if (search.trim()) params.set("q", search.trim());
          if (queryListingType) params.set("listingType", queryListingType);
          if (queryPropertyType) params.set("propertyType", queryPropertyType);
          if (activeCategory && activeCategory !== "For You") {
            params.set("category", activeCategory.toLowerCase());
          }
          if (isNearMe && nearMeCoords) {
            params.set("lat", String(nearMeCoords.lat));
            params.set("lon", String(nearMeCoords.lon));
            if (nearMeCoords.accuracy) params.set("accuracy", String(nearMeCoords.accuracy));
          }
          response = await axiosInstance.get(`/posts?${params.toString()}`);
        }
        return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
      },
      initialPageParam: { page: 1, cursor: undefined },
      pages: current + 1,
      staleTime: 60 * 1000,
    });
  }, [data?.pages?.length, hasNextPage]);

  // Infinite scroll implementation
  const observerRef = useRef(null);
  const loadMoreRef = useCallback((node) => {
    if (isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
      // Fire ~2 cards before the sentinel is actually visible so the next
      // page is usually already in place by the time the user gets there.
    }, { threshold: 0, rootMargin: '1200px' });

    if (node) observerRef.current.observe(node);
  }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

  const posts = useMemo(() => {
    const allPosts = (data?.pages || []).flatMap((page) => page?.posts || []);
    
    // Check if feed is structured (for "For You" category)
    const isStructured = data?.pages?.[0]?.pagination?.structured;
    
    if (isStructured && activeCategory === "For You") {
      // Return posts in the order they came from backend (already structured)
      return allPosts
        .filter((post) => {
          // Hide own posts from marketplace feed after 1 hour of creation
          const authorId = typeof post.author === 'object' ? post.author._id : post.author;
          const isOwnPost = String(authorId) === String(authUser?._id);
          if (isOwnPost) {
            const postAge = Date.now() - new Date(post.createdAt).getTime();
            const oneHour = 60 * 60 * 1000;
            if (postAge > oneHour) return false;
          }

          const cityOk = appliedFilters.city
            ? String(post.city || "").toLowerCase().includes(appliedFilters.city.toLowerCase())
            : true;
          const localityOk = appliedFilters.locality
            ? `${post.locality || ""} ${post.caption || ""}`.toLowerCase().includes(appliedFilters.locality.toLowerCase())
            : true;

          const price = Number(post.price || 0);
          const minOk = price >= Number(appliedFilters.budgetMin || 0);
          const maxLimit = Number(appliedFilters.budgetMax || 0);
          const maxOk = maxLimit <= 0 ? true : price <= maxLimit;

          return cityOk && localityOk && minOk && maxOk;
        })
        .map((post) => ({
          ...post,
          media: normalizeMedia(post),
          likesCount: Number(post.likesCount || 0),
        }));
    }

    // Standard feed for other categories
    return allPosts
      .filter((post) => {
        // Hide own posts from marketplace feed after 1 hour of creation
        const authorId = typeof post.author === 'object' ? post.author._id : post.author;
        const isOwnPost = String(authorId) === String(authUser?._id);
        if (isOwnPost) {
          const postAge = Date.now() - new Date(post.createdAt).getTime();
          const oneHour = 60 * 60 * 1000;
          if (postAge > oneHour) return false;
        }

        const cityOk = appliedFilters.city
          ? String(post.city || "").toLowerCase().includes(appliedFilters.city.toLowerCase())
          : true;
        const localityOk = appliedFilters.locality
          ? `${post.locality || ""} ${post.caption || ""}`.toLowerCase().includes(appliedFilters.locality.toLowerCase())
          : true;

        const price = Number(post.price || 0);
        const minOk = price >= Number(appliedFilters.budgetMin || 0);
        const maxLimit = Number(appliedFilters.budgetMax || 0);
        const maxOk = maxLimit <= 0 ? true : price <= maxLimit;

        const verifiedRole = ["Broker", "Seller", "Landlord"].includes(post.author?.activeRole || post.author?.primaryRole);
        const verifiedOk = activeCategory === "Verified" ? verifiedRole : true;
        const luxuryOk = activeCategory === "Luxury" ? Number(post.price || 0) > 30000000 : true;
        const investmentOk = activeCategory === "Investment" ? Number(post.areaSqft || 0) >= 2000 : true;
        // "Near Me" is filtered + distance-ranked entirely server-side (a
        // $geoNear pipeline) — no client-side location filter, and its order
        // must be preserved (see the sort below).
        return cityOk && localityOk && minOk && maxOk && verifiedOk && luxuryOk && investmentOk;
      })
      .sort((a, b) => {
        if (activeCategory !== "Recent") return 0;
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      })
      .map((post) => ({
        ...post,
        media: normalizeMedia(post),
        likesCount: Number(post.likesCount || 0),
      }));
  }, [activeCategory, appliedFilters, authUser?.city, data]);

  // Deferred secondary queries: fire ONLY after the primary propertyFeed is loaded
  // to avoid choking the browser's 6-connection HTTP limit during initial load.
  const { data: personalizedRecommendations = [] } = useQuery({
    queryKey: ["personalizedRecommendations"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/personalization/recommendations?limit=12");
      return res.data?.data?.recommendations || [];
    },
    enabled: Boolean(authUser && isFeedLoaded),
    staleTime: 3 * 60 * 1000,
  });

  const { data: trendingLocations = [] } = useQuery({
    queryKey: ["trendingLocations"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/personalization/trending-locations?limit=5");
      return res.data?.data?.trendingLocations || [];
    },
    enabled: Boolean(authUser && isFeedLoaded),
    staleTime: 5 * 60 * 1000,
  });

  const { data: trendingNearYou = [] } = useQuery({
    queryKey: ["trendingNearYou", liveLocation?.lat, liveLocation?.lon],
    queryFn: async () => {
      if (!authUser) return [];
      const params = { limit: 10 };
      if (liveLocation?.lat && liveLocation?.lon) {
        params.lat = liveLocation.lat;
        params.lon = liveLocation.lon;
      }
      const res = await axiosInstance.get("/personalization/trending-near-you", { params });
      return res.data?.data?.properties || [];
    },
    enabled: Boolean(authUser && isFeedLoaded),
    staleTime: 60_000,
  });

  // Fetch active sponsored advertisements for the feed
  const targetCityForAds = appliedFilters?.city || authUser?.city || "";
  const targetIntentForAds = activeCategory === "Buy" || activeCategory === "Rent" ? activeCategory : undefined;

  const { data: activeAdvertisementsRaw = [] } = useQuery({
    queryKey: ["activeAdvertisements", targetCityForAds, targetIntentForAds],
    queryFn: async () => {
      const res = await axiosInstance.get("/advertisements/active", {
        params: {
          city: targetCityForAds || undefined,
          intent: targetIntentForAds,
          limit: 10,
        },
      });
      return res.data?.data?.ads || [];
    },
    enabled: Boolean(isFeedLoaded),
    staleTime: 5 * 60 * 1000,
  });

  const activeAds = useMemo(() => {
    const list = Array.isArray(activeAdvertisementsRaw) ? activeAdvertisementsRaw : [];
    return list.filter((ad) => !dismissedAds.has(String(ad._id)));
  }, [activeAdvertisementsRaw, dismissedAds]);

  const handleAdDismiss = (adId) => {
    setDismissedAds((prev) => new Set(prev).add(String(adId)));
  };

  // Interleave "Recommended for You" / "Trending Near You" suggestion cards
  // and Sponsored Advertisements into the main feed.
  const activeRecommended = useMemo(
    () => personalizedRecommendations.filter((p) => !dismissedRecs.has(String(p._id))),
    [personalizedRecommendations, dismissedRecs]
  );
  const activeTrending = useMemo(
    () => trendingNearYou.filter((p) => !dismissedRecs.has(String(p.id))),
    [trendingNearYou, dismissedRecs]
  );

  const feedItems = useMemo(() => {
    const base = posts.map((post) => ({ type: "post", post }));
    const shouldInterleaveSuggestions =
      activeCategory === "For You" && !search.trim() && (activeRecommended.length > 0 || activeTrending.length > 0);
    const hasAds = activeAds.length > 0 && !search.trim();

    if (!shouldInterleaveSuggestions && !hasAds) return base;

    const recQueue = [...activeRecommended];
    const trendQueue = [...activeTrending];
    const adQueue = [...activeAds];
    let preferRecommended = true;
    const result = [];

    base.forEach((item, index) => {
      result.push(item);

      // Suggestions: after 3rd post (index 2), then every 4 posts after (index 6, 10, ...)
      const shouldInsertSuggestion =
        shouldInterleaveSuggestions && (index === 2 || (index > 2 && (index - 2) % 4 === 0));
      if (shouldInsertSuggestion) {
        let suggestion = null;
        if (preferRecommended && recQueue.length > 0) {
          suggestion = { type: "suggestion", suggestionType: "recommended", data: recQueue.shift() };
        } else if (trendQueue.length > 0) {
          suggestion = { type: "suggestion", suggestionType: "trending", data: trendQueue.shift() };
        } else if (recQueue.length > 0) {
          suggestion = { type: "suggestion", suggestionType: "recommended", data: recQueue.shift() };
        }
        preferRecommended = !preferRecommended;
        if (suggestion) result.push(suggestion);
      }

      // Sponsored Ad cadence: after 2nd post (index 1), or for 1-post feeds, then every 5 posts
      const shouldInsertAd =
        hasAds &&
        (index === 1 || (posts.length === 1 && index === 0) || (index > 1 && (index - 1) % 5 === 0));
      if (shouldInsertAd && adQueue.length > 0) {
        const nextAd = adQueue.shift();
        result.push({ type: "ad", data: nextAd });
        adQueue.push(nextAd);
      }
    });

    return result;
  }, [posts, activeCategory, search, activeRecommended, activeTrending, activeAds]);

  const handleSuggestionDismiss = (postId) => {
    setDismissedRecs((prev) => new Set(prev).add(String(postId)));
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["personalizedRecommendations"] });
      queryClient.invalidateQueries({ queryKey: ["trendingNearYou"] });
    }, 400);
  };


  const nearMeMeta = data?.pages?.[0]?.meta?.nearMe || null;
  const nearMeInfo = useMemo(() => {
    if (!isNearMe || !nearMeMeta) return "";
    if (nearMeMeta.mode === "geo") {
      const where = nearMeMeta.pointSource === "gps" ? "you"
        : nearMeMeta.pointSource === "saved" ? (liveLocation?.city || "your saved location")
        : "your city";
      const n = nearMeMeta.withinRadius;
      const age = liveLocation?.capturedAt ? ` · updated ${relativeTimeShort(liveLocation.capturedAt)}` : "";
      return `${n} listing${n === 1 ? "" : "s"} within ${nearMeMeta.radiusKm} km of ${where}${nearMeMeta.pointSource !== "gps" ? age : ""}`;
    }
    if (nearMeMeta.mode === "city") {
      return `Showing listings in ${nearMeMeta.city || "your city"} — turn on location for distance-sorted results`;
    }
    return "Showing all listings — add your location to see what's nearby";
  }, [isNearMe, nearMeMeta, liveLocation]);

  // Remember where the user was in the feed so tapping a card and coming
  // back doesn't dump them at the top. Keyed by the feed's filter signature;
  // disabled while a non-feed section (chat/communities/…) is showing.
  const feedScrollKey =
    activeSection === "marketplace"
      ? [activeCategory, search, searchType, queryListingType || "all", queryPropertyType || "all", appliedFilters.city || "", appliedFilters.locality || ""].join("|")
      : null;
  useScrollRestoration(feedScrollKey, !isLoading && posts.length > 0);

  // Lightweight polling for "is there something new" — checks just the newest
  // post's id/timestamp every 30s instead of re-running the full feed query,
  // and only while this tab is visible/focused (React Query's default
  // refetchIntervalInBackground: false pauses it otherwise).
  const { data: latestFeedPost } = useQuery({
    queryKey: ["propertyFeedLatest"],
    queryFn: async () => {
      const response = await axiosInstance.get("/posts/latest");
      return response.data?.data || null;
    },
    enabled: Boolean(authUser?._id && isFeedLoaded && !search.trim()),
    refetchInterval: 30000,
    staleTime: 0,
  });

  // Was comparing `posts[0]` (the currently-displayed feed's first post)
  // against the true chronologically-latest post platform-wide — that only
  // makes sense for a strictly recency-sorted feed. "For You" (the default
  // tab) is personalization-ranked, so the newest post is almost never
  // actually first; the banner ended up permanently stuck on for anyone
  // whose top-ranked post wasn't also the newest, and re-fetching the same
  // ranked query never "fixed" the mismatch, so clicking it visibly did
  // nothing. Comparing against when THIS feed was last loaded, instead of
  // against feed position, works regardless of sort order.
  // Deliberately NOT wall-clock "now" — using new Date() here meant any
  // incidental background refetch (window refocus, an automatic React Query
  // retry, a still-cached response) would push feedLoadedAt forward even
  // when the actual data didn't change, permanently masking real new posts
  // created before that refetch. Anchoring to the newest createdAt actually
  // present in the loaded first page means a stale/cached refetch that
  // returns the same posts leaves this unchanged, so the comparison against
  // latestFeedPost stays meaningful no matter how often background refetches
  // fire.
  const [feedLoadedAt, setFeedLoadedAt] = useState(null);
  useEffect(() => {
    const firstPagePosts = data?.pages?.[0]?.posts || [];
    if (firstPagePosts.length === 0) return;
    const newestInFeed = firstPagePosts.reduce((max, post) => {
      const t = new Date(post.createdAt).getTime();
      return Number.isFinite(t) && t > max ? t : max;
    }, 0);
    if (newestInFeed > 0) setFeedLoadedAt(new Date(newestInFeed));
  }, [data]);

  // /posts/latest returns the newest PUBLISHED post platform-wide, ignoring
  // any feed filter. That's only a meaningful "there are new posts" signal
  // for the unfiltered, recency-relevant views — on "Following" (friends
  // only) or "Near Me" (geo-filtered) or any category chip, the newest
  // global post is almost never in-scope, so the banner would be stuck on
  // permanently and clicking it (a re-fetch of the filtered feed) could
  // never clear it.
  // /posts/latest is platform-wide, so the banner only makes sense on the
  // unfiltered "For You"/"Recent" feed. Any search (e.g. a city like
  // "Ratlam"), author lookup, or filter-sheet narrowing scopes the feed to
  // a subset in which the newest global post almost never appears — and
  // React Query keeps the last `latestFeedPost` value even after its query
  // is disabled by `!search.trim()`, so without this guard a stale value
  // compared against the (older) newest post in the filtered feed lights
  // the banner up for a search that has no new posts at all.
  const newPostsBannerEligible =
    (activeCategory === "For You" || activeCategory === "Recent") &&
    !search.trim() &&
    !searchType &&
    !hasActiveMarketplaceFilters;
  const hasNewPosts = Boolean(
    newPostsBannerEligible &&
    latestFeedPost?.latestCreatedAt &&
    feedLoadedAt &&
    new Date(latestFeedPost.latestCreatedAt).getTime() > feedLoadedAt.getTime()
  );

  const handleShowNewPosts = () => {
    setFeedRefreshSeed((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const { distance: pullDistance, refreshing: pullRefreshing, threshold: pullThreshold } = usePullToRefresh(
    () => setFeedRefreshSeed((s) => s + 1),
    { enabled: activeSection === "marketplace" && !isComposerOpen }
  );

  const { data: draftsListData, isLoading: isDraftsListLoading } = useQuery({
    queryKey: ["myDrafts", authUser?._id],
    queryFn: async () => {
      const response = await axiosInstance.get("/posts", {
        params: { authorId: authUser._id, status: "DRAFT", limit: 50 },
      });
      return response.data?.data?.posts || [];
    },
    enabled: Boolean(authUser?._id) && showDraftsList,
  });
  const draftsList = draftsListData || [];

  // Maps a saved draft post back into the composer's flat draft shape
  // (postMeta's requirement/project/investment sub-objects get flattened
  // back to top-level fields) so resuming feels identical to creating —
  // every field editable through the same steps, not a stripped-down form.
  const mapPostToDraftState = (post) => {
    const flatMeta = post.postMeta && typeof post.postMeta === "object" && !Array.isArray(post.postMeta) ? post.postMeta : {};
    const requirement = flatMeta.requirement || {};
    const project = flatMeta.project || {};
    const investment = flatMeta.investment || {};
    const land = flatMeta.land || {};
    const commercial = flatMeta.commercial || {};
    const residential = flatMeta.residential || {};
    const flatmate = flatMeta.flatmate || {};
    return {
      postType: post.postType || "PROPERTY_SALE",
      listingType: post.listingType || "Sell",
      propertyType: post.propertyType || "Apartment",
      title: post.title || "",
      caption: post.caption || "",
      city: post.city || "",
      locality: post.locality || "",
      price: post.price || "",
      bedrooms: post.bedrooms || "",
      bathrooms: post.bathrooms || "",
      areaSqft: post.areaSqft || "",
      mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls.join(",") : "",
      mediaFiles: [],
      moveInDate: requirement.moveInDate || "",
      availableFromDate: requirement.availableFromDate || "",
      leaseDurationMonths: requirement.leaseDurationMonths || "",
      depositAmount: requirement.depositAmount || "",
      budgetMin: requirement.budgetMin || "",
      budgetMax: requirement.budgetMax || "",
      occupancyPreference: requirement.occupancyPreference || "",
      genderPreference: requirement.genderPreference || "",
      furnishedPreference: requirement.furnishedPreference || "",
      requirementPropertyType: requirement.requirementPropertyType || "",
      parkingRequired: Boolean(requirement.parkingRequired),
      amenitiesText: requirement.amenitiesText || "",
      possessionDate: requirement.possessionDate || "",
      loanRequired: Boolean(requirement.loanRequired),
      tenantType: requirement.tenantType || "",
      occupation: requirement.occupation || "",
      latitude: post.latitude ?? null,
      longitude: post.longitude ?? null,
      reraNumber: project.reraNumber || "",
      projectName: project.projectName || "",
      launchDate: project.launchDate || "",
      brochureUrl: project.brochureUrl || "",
      investmentThesis: investment.thesis || "",
      landArea: land.landArea || "",
      landAreaUnit: land.landAreaUnit || "",
      soilType: land.soilType || "",
      waterAvailability: land.waterAvailability || "",
      roadAccess: Boolean(land.roadAccess),
      electricityAvailable: Boolean(land.electricityAvailable),
      commercialType: commercial.commercialType || "",
      carpetArea: commercial.carpetArea || "",
      floorNumber: residential.floorNumber ?? commercial.floorNumber ?? flatMeta.floorNumber ?? "",
      washrooms: commercial.washrooms || "",
      furnishing: residential.furnishing || flatMeta.furnishing || "",
      facing: residential.facing || flatMeta.facing || "",
      totalFloors: residential.totalFloors ?? flatMeta.totalFloors ?? "",
      ageOfProperty: residential.ageOfProperty || flatMeta.ageOfProperty || "",
      maintenanceCharges: residential.maintenanceCharges ?? flatMeta.maintenanceCharges ?? "",
      houseRules: Array.isArray(residential.houseRules)
        ? residential.houseRules
        : Array.isArray(flatMeta.houseRules)
          ? flatMeta.houseRules
          : typeof (residential.houseRules || flatMeta.houseRules) === "string" && (residential.houseRules || flatMeta.houseRules).trim()
            ? (residential.houseRules || flatMeta.houseRules).split(/[\n,]+/).map((s) => s.trim()).filter(Boolean)
            : [],
      spaceType: residential.spaceType || flatMeta.spaceType || post?.spaceType || "",
      preferredTenants: Array.isArray(residential.preferredTenants) && residential.preferredTenants.length > 0
        ? residential.preferredTenants
        : (Array.isArray(flatMeta.preferredTenants) ? flatMeta.preferredTenants : []),
      amenities: Array.isArray(flatMeta.amenities) && flatMeta.amenities.length > 0
        ? flatMeta.amenities
        : Array.isArray(residential.amenities) && residential.amenities.length > 0
          ? residential.amenities
          : String(requirement.amenitiesText || "").split(",").map((item) => item.trim()).filter(Boolean),
      alternativeMobile: residential.alternativeMobile || flatMeta.alternativeMobile || "",
      electricityBillUrl: residential.electricityBillUrl || flatMeta.electricityBillUrl || flatMeta.electricityBill || "",
      roomType: flatmate.roomType || "",
      occupancy: flatmate.occupancy || "",
      rentPerPerson: flatmate.rentPerPerson || "",
      flatmateDeposit: flatmate.depositAmount || "",
      availableFrom: flatmate.availableFrom || "",
      flatmateFurnishing: flatmate.furnishing || "",
      flatmateGender: flatmate.genderPreference || "",
      targetAudience: Array.isArray(flatmate.targetAudience) ? flatmate.targetAudience : [],
      lifestyleTags: Array.isArray(flatmate.lifestyleTags) ? flatmate.lifestyleTags : [],
      amenityTags: Array.isArray(flatmate.amenityTags) ? flatmate.amenityTags : [],
      collegeName: flatmate.collegeName || "",
      workplaceName: flatmate.workplaceName || "",
      seekerBudgetMin: flatmate.budgetMin || "",
      seekerBudgetMax: flatmate.budgetMax || "",
      preferredLocalities: Array.isArray(flatmate.preferredLocalities) ? flatmate.preferredLocalities.join(", ") : "",
      groupSize: flatmate.groupSize || "",
      status: post?.status || "DRAFT",
    };
  };

  const resumeDraft = (post, targetStep = 1) => {
    setDraft(mapPostToDraftState(post));
    setEditingDraftId(post._id);
    setShowDraftsList(false);
    setComposerResult(null);
    setComposerStep(targetStep);
  };

  // Same underlying flow as resuming a draft — the composer always PUTs to
  // the existing post when editingDraftId is set, and submitting normally
  // (not "Save as Draft") re-sends status: "PUBLISHED", so this can't
  // accidentally unpublish a live listing.
  const handleEditPost = (post, options = {}) => {
    const targetStep = typeof options === "number" ? options : (options?.step ?? 2);
    const expandVerification = typeof options === "object" ? Boolean(options?.expandVerification) : false;
    resumeDraft(post, targetStep);
    if (expandVerification) {
      setDraft((prev) => ({ ...prev, expandVerificationShutter: true }));
    }
    setIsComposerOpen(true);
  };

  const { mutate: deleteDraft, isPending: deletingDraft } = useMutation({
    mutationFn: async (postId) => {
      await axiosInstance.delete(`/posts/${postId}`);
    },
    onSuccess: () => {
      toast.success("Draft deleted");
      queryClient.invalidateQueries({ queryKey: ["myDrafts"] });
      setDraftToDelete(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to delete draft");
      setDraftToDelete(null);
    },
  });

  // The wizard's steps, collapsed from the old 6. Every post type gets the
  // photo step — it's just optional (skippable) for requirement posts,
  // enforced by stepValid rather than by hiding the step.
  const composerSteps = COMPOSER_STEPS;
  const totalComposerSteps = composerSteps.length;
  const stepKey = composerSteps[composerStep - 1] || "type";

  // Silent-autosave bookkeeping (logic lives in the effect below createPost).
  const [autosaveState, setAutosaveState] = useState("idle"); // idle | saving | saved
  const autosaveInFlight = useRef(false);
  const lastAutosaveSnapshot = useRef("");

  // Shared by the explicit Save/Publish action and the silent autosave —
  // both send the identical field set, only `status` differs.
  const buildComposerPayload = (status) => {
    const isRequirement = String(draft.postType || "").startsWith("REQUIREMENT_");
    const mediaUrls = String(draft.mediaUrls || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const residential = {
      furnishing: draft.furnishing || "",
      facing: draft.facing || "",
      floorNumber: draft.floorNumber !== "" && draft.floorNumber !== undefined ? Number(draft.floorNumber) : undefined,
      totalFloors: draft.totalFloors !== "" && draft.totalFloors !== undefined ? Number(draft.totalFloors) : undefined,
      ageOfProperty: draft.ageOfProperty || "",
      maintenanceCharges: draft.maintenanceCharges !== "" && draft.maintenanceCharges !== undefined ? Number(draft.maintenanceCharges) : undefined,
      houseRules: Array.isArray(draft.houseRules) ? draft.houseRules : (draft.houseRules ? [draft.houseRules] : []),
      spaceType: draft.spaceType || "",
      preferredTenants: Array.isArray(draft.preferredTenants) ? draft.preferredTenants : [],
      alternativeMobile: draft.alternativeMobile || "",
      electricityBillUrl: draft.electricityBillUrl || "",
    };

    const postMeta = {
      residential,
      amenities: Array.isArray(draft.amenities) ? draft.amenities : [],
      requirement: {
        furnishedPreference: draft.furnishedPreference || "",
        parkingRequired: Boolean(draft.parkingRequired),
        amenitiesText: Array.isArray(draft.amenities) && draft.amenities.length > 0 ? draft.amenities.join(", ") : (draft.amenitiesText || ""),
        possessionDate: draft.possessionDate || "",
        loanRequired: Boolean(draft.loanRequired),
        moveInDate: draft.moveInDate || "",
        availableFromDate: draft.availableFromDate || "",
        leaseDurationMonths: Number(draft.leaseDurationMonths || 0),
        budgetMin: Number(draft.budgetMin || 0),
        budgetMax: Number(draft.budgetMax || 0),
        occupancyPreference: draft.occupancyPreference || "",
        genderPreference: draft.genderPreference || "",
        requirementPropertyType: draft.requirementPropertyType || "",
        depositAmount: Number(draft.depositAmount || 0),
        tenantType: draft.tenantType || "",
        occupation: draft.occupation || "",
      },
      project: {
        projectName: draft.projectName || "",
        launchDate: draft.launchDate || "",
        reraNumber: draft.reraNumber || "",
        brochureUrl: draft.brochureUrl || "",
      },
      investment: {
        thesis: draft.investmentThesis || "",
      },
      land: {
        landArea: Number(draft.landArea || 0),
        landAreaUnit: draft.landAreaUnit || "",
        soilType: draft.soilType || "",
        waterAvailability: draft.waterAvailability || "",
        roadAccess: Boolean(draft.roadAccess),
        electricityAvailable: Boolean(draft.electricityAvailable),
      },
      commercial: {
        commercialType: draft.commercialType || "",
        carpetArea: Number(draft.carpetArea || 0),
        floorNumber: Number(draft.floorNumber || 0),
        washrooms: Number(draft.washrooms || 0),
      },
      flatmate: {
        roomType: draft.roomType || "",
        occupancy: Number(draft.occupancy || 0),
        rentPerPerson: Number(draft.rentPerPerson || 0),
        depositAmount: Number(draft.flatmateDeposit || 0),
        availableFrom: draft.availableFrom || "",
        furnishing: draft.flatmateFurnishing || "",
        genderPreference: draft.flatmateGender || "",
        targetAudience: Array.isArray(draft.targetAudience) ? draft.targetAudience : [],
        lifestyleTags: Array.isArray(draft.lifestyleTags) ? draft.lifestyleTags : [],
        amenityTags: Array.isArray(draft.amenityTags) ? draft.amenityTags : [],
        collegeName: draft.collegeName || "",
        workplaceName: draft.workplaceName || "",
        budgetMin: Number(draft.seekerBudgetMin || 0),
        budgetMax: Number(draft.seekerBudgetMax || 0),
        preferredLocalities: draft.preferredLocalities
          ? String(draft.preferredLocalities).split(",").map((s) => s.trim()).filter(Boolean)
          : [],
        groupSize: Number(draft.groupSize || 0),
      },
    };

    let price = Number(draft.price || 0);
    if (isRequirement) price = Number(draft.budgetMax || draft.price || 0);
    else if (draft.postType === "FLATMATE_OFFER") price = Number(draft.rentPerPerson || draft.price || 0);
    else if (draft.postType === "FLATMATE_SEEKING") price = Number(draft.seekerBudgetMax || draft.price || 0);

    return {
      ...draft,
      status,
      price,
      mediaUrls,
      postType: draft.postType,
      postMeta,
      latitude: draft.latitude,
      longitude: draft.longitude,
    };
  };

  const { mutate: createPost, isPending: creating } = useMutation({
    mutationFn: async (statusOverride) => {
      // If a background autosave is mid-flight it may still be creating the
      // draft — wait for it so we PUT to that draft instead of POSTing a
      // duplicate.
      for (let i = 0; i < 50 && autosaveInFlight.current; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const payload = buildComposerPayload(statusOverride || "PUBLISHED");
      // Resuming a saved draft updates that same post instead of creating
      // a duplicate — updatePropertyPost accepts the identical field set.
      const response = editingDraftId
        ? await axiosInstance.put(`/posts/${editingDraftId}`, payload)
        : await axiosInstance.post("/posts", payload);
      return response.data?.data?.post;
    },
    onSuccess: (data) => {
      // Drafts aren't visible in the public feed, so only splice a
      // published post into the feed cache — a draft only shows up in
      // "My Drafts" (fetched separately).
      if (data?.status === "PUBLISHED") {
        // Prepend the new post across all active propertyFeed queries so author immediately sees it at top in 0ms
        queryClient.setQueriesData({ queryKey: ["propertyFeed"] }, (oldData) => {
          if (!oldData?.pages?.[0]) return oldData;

          const newPost = {
            ...data,
            likesCount: 0,
            isLikedByMe: false,
            savesCount: 0,
            isSavedByMe: false,
          };

          return {
            ...oldData,
            pages: [
              {
                ...oldData.pages[0],
                posts: [newPost, ...(oldData.pages[0].posts || [])],
              },
              ...oldData.pages.slice(1),
            ],
          };
        });

        // Invalidate feed and my posts to ensure complete server sync
        queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
        queryClient.invalidateQueries({ queryKey: ["myPosts"] });
        toast.success("Post published successfully! It is now live at the top of your feed.");
      } else {
        toast.success("Draft saved successfully!");
      }

      // Covers both directions: a draft that just got published should
      // disappear from "My Drafts", and a re-saved draft should refresh
      // there with its latest edits.
      if (editingDraftId || data?.status === "DRAFT") {
        queryClient.invalidateQueries({ queryKey: ["myDrafts"] });
      }

      setComposerResult(data?.status === "DRAFT" ? "DRAFT" : "PUBLISHED");

      if (isPostHogEnabled()) {
        posthog.capture(data?.status === "DRAFT" ? "post_draft_saved" : "post_created", {
          postType: data?.postType,
          listingType: data?.listingType,
          propertyType: data?.propertyType,
        });
      }
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create post");
    },
  });

  // --- Silent autosave --------------------------------------------------
  // Once the post has a title, changes are persisted as a DRAFT in the
  // background so a closed tab / back-navigation never loses work. The first
  // save creates the draft and captures its id into editingDraftId; every
  // save after that updates the same post. No toasts, no step changes.
  const { mutateAsync: runAutosave } = useMutation({
    mutationFn: async ({ payload, draftId }) => {
      const response = draftId
        ? await axiosInstance.put(`/posts/${draftId}`, payload)
        : await axiosInstance.post("/posts", payload);
      return response.data?.data?.post;
    },
  });

  useEffect(() => {
    if (!isComposerOpen || showDraftsList || composerResult || creating) return;
    // Don't autosave until the user is actually filling in the post.
    if (stepKey === "type") return;
    if (!String(draft.title || "").trim()) return;

    const snapshot = JSON.stringify(buildComposerPayload("DRAFT"));
    if (snapshot === lastAutosaveSnapshot.current) return;

    const timer = setTimeout(async () => {
      if (autosaveInFlight.current) return;
      autosaveInFlight.current = true;
      setAutosaveState("saving");
      try {
        const payload = buildComposerPayload("DRAFT");
        const saved = await runAutosave({ payload, draftId: editingDraftId });
        if (saved?._id && !editingDraftId) setEditingDraftId(saved._id);
        lastAutosaveSnapshot.current = snapshot;
        setAutosaveState("saved");
        queryClient.invalidateQueries({ queryKey: ["myDrafts"] });
      } catch {
        // Silent — an explicit Save/Publish still surfaces real errors.
        setAutosaveState("idle");
      } finally {
        autosaveInFlight.current = false;
      }
    }, 2500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, isComposerOpen, showDraftsList, composerResult, creating, stepKey, editingDraftId]);

  const [mediaUploadProgress, setMediaUploadProgress] = useState(0);

  const { mutate: uploadMedia, isPending: isUploadingMedia } = useMutation({
    mutationFn: async (files) => {
      const newUrls = await uploadPropertyMedia(files, setMediaUploadProgress);
      return { mediaUrls: newUrls, count: newUrls.length };
    },
    onMutate: () => {
      setMediaUploadProgress(0);
    },
    onSuccess: (data) => {
      const newUrls = data.mediaUrls || [];
      setDraft((prev) => ({
        ...prev,
        mediaUrls: prev.mediaUrls ? `${prev.mediaUrls},${newUrls.join(",")}` : newUrls.join(","),
      }));
      toast.success(`Successfully uploaded ${data.count} file(s)`);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error?.message || error?.message || "Failed to upload media");
    },
    onSettled: () => {
      setMediaUploadProgress(0);
    },
  });

  // Patch a single post across every cached feed variant. The feed queryKey
  // carries extra segments (geo, near-me) that a hand-built key would miss —
  // so match by the ["propertyFeed"] prefix and never guess the full key.
  const patchPostInFeeds = (postId, patch) => {
    queryClient.setQueriesData({ queryKey: ["propertyFeed"] }, (old) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          posts: (page.posts || []).map((post) =>
            post._id === postId ? { ...post, ...patch(post) } : post
          ),
        })),
      };
    });
  };

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyFeed"] });
      const snapshot = queryClient.getQueriesData({ queryKey: ["propertyFeed"] });
      patchPostInFeeds(postId, (post) => {
        const liked = !post.isLikedByMe;
        return { isLikedByMe: liked, likesCount: Math.max(0, (post.likesCount || 0) + (liked ? 1 : -1)) };
      });
      return { snapshot };
    },
    onError: (err, postId, context) => {
      context?.snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (data, postId) => {
      if (!data) return;
      patchPostInFeeds(postId, () => ({
        isLikedByMe: Boolean(data.liked),
        ...(typeof data.likesCount === "number" ? { likesCount: data.likesCount } : {}),
      }));
    },
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyFeed"] });
      const snapshot = queryClient.getQueriesData({ queryKey: ["propertyFeed"] });
      patchPostInFeeds(postId, (post) => {
        const saved = !post.isSavedByMe;
        return { isSavedByMe: saved, savesCount: Math.max(0, (post.savesCount || 0) + (saved ? 1 : -1)) };
      });
      return { snapshot };
    },
    onError: (err, postId, context) => {
      context?.snapshot?.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSuccess: (data, postId) => {
      if (!data) return;
      patchPostInFeeds(postId, () => ({
        isSavedByMe: Boolean(data.saved),
        ...(typeof data.savesCount === "number" ? { savesCount: data.savesCount } : {}),
      }));
    },
  });

  const { mutate: submitPostReport, isPending: isReportPending } = useMutation({
    mutationFn: async ({ postId, reasonCode, description }) => {
      const response = await axiosInstance.post(`/posts/${postId}/report`, { reasonCode, description });
      return response.data;
    },
    onSuccess: (_data, variables) => {
      setReportSubmitted(true);
      // Hide it from this user's feed immediately rather than waiting on a refetch.
      queryClient.setQueriesData({ queryKey: ["propertyFeed"] }, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: (page.posts || []).filter((post) => post._id !== variables.postId),
          })),
        };
      });
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to submit report");
    },
  });

  // Fetch role-based statistics for the sidebar
  const { data: roleStatsData } = useQuery({
    queryKey: ["roleStats"],
    queryFn: async () => {
      if (!authUser) return null;
      const res = await axiosInstance.get("/role-stats");
      return res.data?.data || null;
    },
    enabled: Boolean(authUser && isFeedLoaded),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 60000, // Refetch every minute
  });

  const roleWidgets = useMemo(() => {
    if (roleStatsData?.widgets) {
      return roleStatsData.widgets;
    }
    
    // Fallback to static data if API fails
    const role = String(authUser?.activeRole || authUser?.primaryRole || "Buyer");
    if (role === "Seller" || role === "Landlord") {
      return [
        { title: "Listing Views", value: "8.2k", hint: "+14% this week" },
        { title: "Inquiries", value: "126", hint: "22 new today" },
        { title: "Scheduled Visits", value: "18", hint: "6 upcoming" },
      ];
    }
    if (role === "Broker") {
      return [
        { title: "Active Leads", value: "94", hint: "12 high intent" },
        { title: "Inventory", value: "57", hint: "8 added this week" },
        { title: "Conversion Rate", value: "21%", hint: "+2.3% MoM" },
      ];
    }
    return [
      { title: "Saved Homes", value: "32", hint: "7 new matches" },
      { title: "Recently Viewed", value: "18", hint: "Across 4 cities" },
      { title: "Price Drops", value: "9", hint: "Updated today" },
    ];
  }, [roleStatsData, authUser?.activeRole, authUser?.primaryRole]);

  const profileCity = authUser?.city || authUser?.locationDetails?.city || "";
  const [detectedCity, setDetectedCity] = useState(profileCity);

  useEffect(() => {
    if (!profileCity) {
      getAutoDetectedCity().then((city) => {
        if (city) setDetectedCity(city);
      });
    } else {
      setDetectedCity(profileCity);
    }
  }, [profileCity]);

  const userCity = detectedCity || profileCity;

  // Fetch trending news from backend filtered by user region
  const { data: newsResponse, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ["trendingNews", userCity],
    queryFn: async () => {
      const cityParam = userCity ? `?city=${encodeURIComponent(userCity)}` : "";
      const response = await axiosInstance.get(`/news/trending${cityParam}`);
      return response.data;
    },
    enabled: Boolean(isFeedLoaded),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  const newsData = newsResponse?.data || [];

  const composerMedia = useMemo(
    () =>
      String(draft.mediaUrls || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    [draft.mediaUrls]
  );

  const previewPost = useMemo(() => {
    const isRequirement = String(draft.postType || "").startsWith("REQUIREMENT_");
    const mediaUrls = composerMedia.length > 0
      ? composerMedia
      : isRequirement
        ? []
        : ["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80"];

    const isVideo = composerMedia.length > 0 && isVideoUrl(composerMedia[0]);

    return {
      _id: "preview-post",
      postType: draft.postType,
      listingType: draft.listingType || "Sell",
      propertyType: draft.propertyType || draft.requirementPropertyType || "Apartment",
      title: draft.title || "Modern Living Space",
      caption: draft.caption || "",
      city: draft.city || "Mumbai",
      locality: draft.locality || "",
      price: draft.price ? Number(draft.price) : 0,
      bedrooms: draft.bedrooms ? Number(draft.bedrooms) : null,
      bathrooms: draft.bathrooms ? Number(draft.bathrooms) : null,
      areaSqft: draft.areaSqft ? Number(draft.areaSqft) : null,
      mediaUrls,
      media: mediaUrls,
      mediaType: isVideo ? "video" : "image",
      author: authUser ? {
        _id: authUser._id || "preview-user",
        name: authUser.fullName || authUser.name || "You",
        username: authUser.username || "you",
        profilePicture: authUser.profilePic || authUser.profilePicture || "",
        primaryRole: activeRole || "Owner",
        isOwnerVerified: true,
      } : {
        _id: "preview-user",
        name: "You",
        username: "you",
        profilePicture: "",
        primaryRole: activeRole || "Owner",
        isOwnerVerified: true,
      },
      createdAt: new Date().toISOString(),
      likesCount: 5,
      likes: [{ _id: "u1", name: "Darsh", fullName: "Darsh" }],
      commentsCount: 2,
      viewsCount: 120,
      savesCount: 3,
      isLiked: false,
      isSaved: false,
      latitude: draft.latitude,
      longitude: draft.longitude,
      liveLocation: draft.latitude && draft.longitude ? {
        latitude: draft.latitude,
        longitude: draft.longitude,
        updatedAt: new Date().toISOString(),
      } : null,
    };
  }, [draft, composerMedia, authUser, activeRole]);

  const updateDraft = (field, value) => setDraft((prev) => ({ ...prev, [field]: value }));

  const stepValid = useMemo(() => {
    if (stepKey === "type") return Boolean(draft.postType);
    if (stepKey === "details") return Boolean(String(draft.title || "").trim());
    if (stepKey === "photos") {
      return getPostTypeConfig(draft.postType).requiresMedia ? Boolean(composerMedia.length) : true;
    }
    return true;
  }, [composerMedia.length, stepKey, draft.postType, draft.title]);

  const resetComposer = () => {
    setIsComposerOpen(false);
    setComposerStep(1);
    setComposerResult(null);
    setShowDraftsList(false);
    setEditingDraftId(null);
    setAutosaveState("idle");
    lastAutosaveSnapshot.current = "";
    autosaveInFlight.current = false;
    const defaultPostType = recommendedPostTypes[0] || "PROPERTY_SALE";
    const defaults = POST_TYPE_DEFINITIONS[defaultPostType] || POST_TYPE_DEFINITIONS.PROPERTY_SALE;
    setDraft((prev) => ({
      ...prev,
      postType: defaultPostType,
      listingType: defaults.listingType,
      propertyType: defaults.propertyType,
      title: "",
      caption: "",
      locality: "",
      price: "",
      bedrooms: "",
      bathrooms: "",
      areaSqft: "",
      mediaUrls: "",
      mediaFiles: [],
      moveInDate: "",
      availableFromDate: "",
      leaseDurationMonths: "",
      depositAmount: "",
      budgetMin: "",
      budgetMax: "",
      occupancyPreference: "",
      genderPreference: "",
      furnishedPreference: "",
      requirementPropertyType: "",
      parkingRequired: false,
      amenitiesText: "",
      possessionDate: "",
      loanRequired: false,
      tenantType: "",
      occupation: "",
      reraNumber: "",
      projectName: "",
      launchDate: "",
      brochureUrl: "",
      investmentThesis: "",
      landArea: "",
      landAreaUnit: "",
      soilType: "",
      waterAvailability: "",
      roadAccess: false,
      electricityAvailable: false,
      commercialType: "",
      carpetArea: "",
      floorNumber: "",
      washrooms: "",
      furnishing: "",
      facing: "",
      totalFloors: "",
      ageOfProperty: "",
      maintenanceCharges: "",
      houseRules: [],
      spaceType: "",
      preferredTenants: [],
      amenities: [],
      alternativeMobile: "",
      electricityBillUrl: "",
    }));
  };

  return (
    <AppShell
      hideHero
      lockPageScroll={activeSection === "chat" || (activeSection === "communities" && Boolean(selectedCommunity))}
      hideMobileHeader={activeSection !== "marketplace"}
      autoHideHeaderOnScroll={activeSection === "marketplace"}
      title="Marketplace"
      subtitle="Social-first discovery"
      marketplaceSearch={search}
      onMarketplaceSearchChange={(value, type, authorId) => {
        setSearch(value);
        setSearchType(type || null);
        setSearchAuthorId(authorId || null);
      }}
      onCreateProperty={() => {
        resetComposer();
        setIsComposerOpen(true);
      }}
    >
      <div className="xl:h-full xl:min-h-0">
        <div className="flex gap-4 xl:h-full">
          <aside className="hidden w-[220px] rounded-2xl border border-base-200 bg-base-200/90 p-3 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/60">Navigation</p>
            <div className="mt-2 space-y-1">
              {(() => {
                // Route-only destinations (no marketplace section) slotted in
                // right after Messages.
                const items = [];
                for (const item of LEFT_NAV_ITEMS) {
                  items.push(item);
                  if (item.section === "chat") {
                    items.push({ label: "My Deals", icon: Handshake, to: "/deals" });
                    items.push({ label: "Saved Searches", icon: Bell, to: "/saved-searches" });
                  }
                }
                if (authUser?.isAdmin) items.push(ADMIN_NAV_ITEM);
                return items;
              })().map(({ label, icon, section, to }) => {
                // Renamed-destructure (`icon: NavIcon`) used only in JSX trips
                // up this project's no-unused-vars config as a false positive.
                const NavIcon = icon;
                // Calculate notification counts for badges
                let badgeCount = 0;
                if (section === "activity") {
                  badgeCount = totalUnreadCount; // Total unread notifications
                } else if (section === "connections") {
                  badgeCount = incomingRequestsCount; // Connection requests
                } else if (section === "chat") {
                  badgeCount = messageRequests; // Message requests
                }

                return (
                  <button
                    key={label}
                    type="button"
                    className={`btn btn-sm w-full justify-start rounded-lg border-none relative ${
                      section && activeSection === section
                        ? "bg-primary/15 text-primary hover:bg-primary/15"
                        : "bg-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    }`}
                    onClick={() => {
                      if (to) {
                        navigate(to);
                      } else if (section === "map") {
                        navigate("/map-view");
                      } else if (section === "admin") {
                        navigate("/admin");
                      } else {
                        setActiveSection(section);
                      }
                    }}
                  >
                    <div className="relative">
                      <NavIcon className="size-4" />
                      {badgeCount > 0 && (
                        <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-error text-[9px] font-bold text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </div>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-xl border border-base-300 bg-primary/10 p-3 text-xs text-base-content/70">
              <p className="font-semibold text-primary">Go Premium</p>
              <p className="mt-1">Get more visibility and reach serious buyers faster.</p>
              <button type="button" className="btn btn-sm mt-3 w-full border-none bg-primary text-white hover:bg-primary">Upgrade</button>
            </div>
          </aside>

          <main
            className={`min-w-0 flex-1 bg-transparent xl:h-[calc(100dvh-7.1rem)] xl:overflow-y-auto xl:rounded-2xl xl:p-1 xl:pb-6 ${
              activeSection === "chat" || (activeSection === "communities" && selectedCommunity)
                ? "h-[calc(100dvh-4rem)] overflow-hidden rounded-none p-0"
                : activeSection === "communities"
                  ? "rounded-2xl p-1 pb-6 xl:h-[calc(100dvh-9rem)] xl:overflow-hidden"
                  : "rounded-2xl p-1 pb-6"
            }`}
          >
            {activeSection === "marketplace" ? (
              <>
                <StoriesBar onCategorySelect={setActiveCategory} />

            <div className="mt-4 border-b border-base-300 pb-3">
              <div className="flex items-center gap-2">
                {CATEGORY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`btn btn-sm rounded-full border-none ${activeCategory === chip ? "bg-primary/15 text-primary hover:bg-primary/15" : "bg-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content"}`}
                    onClick={() => setActiveCategory(chip)}
                  >
                    {chip}
                  </button>
                ))}
                <button
                  type="button"
                  className={`btn btn-sm rounded-full border-none ${hasActiveMarketplaceFilters ? "bg-primary/15 text-primary hover:bg-primary/15" : "bg-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content"}`}
                  onClick={() => setIsFiltersOpen(true)}
                >
                  <Filter className="size-4" />
                  Filters
                </button>
              </div>

            </div>

            {activeBadgeFilter && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-3 py-1.5 text-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5 text-primary font-medium min-w-0">
                  <span className="opacity-75">Filtered by badge:</span>
                  <span className="font-bold underline truncate">"{activeBadgeFilter}"</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveBadgeFilter(null);
                    setSearch("");
                  }}
                  className="btn btn-ghost btn-xs text-primary hover:bg-primary/20 font-semibold gap-1 h-auto min-h-0 py-1 px-2 rounded-lg"
                >
                  <X className="size-3" /> Clear
                </button>
              </div>
            )}

            {activeNaturalParsed && search && (
              <div className="mt-2.5 flex items-center justify-between rounded-xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/20 px-3 py-2 text-xs animate-in fade-in duration-200">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                  <span className="font-semibold text-primary flex items-center gap-1 mr-1">
                    <Sparkles className="size-3.5 fill-primary" /> Smart Match:
                  </span>
                  {activeNaturalParsed.bedrooms && (
                    <span className="rounded-md bg-base-100 border border-primary/20 px-2 py-0.5 font-semibold text-base-content">
                      🛏️ {activeNaturalParsed.bedrooms} BHK
                    </span>
                  )}
                  {activeNaturalParsed.city && (
                    <span className="rounded-md bg-base-100 border border-primary/20 px-2 py-0.5 font-semibold text-base-content">
                      📍 {activeNaturalParsed.city}
                    </span>
                  )}
                  {activeNaturalParsed.maxPrice && (
                    <span className="rounded-md bg-base-100 border border-primary/20 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      💰 Under {formatMoney(activeNaturalParsed.maxPrice)}
                    </span>
                  )}
                  {activeNaturalParsed.nearTransport && (
                    <span className="rounded-md bg-base-100 border border-primary/20 px-2 py-0.5 font-medium text-base-content">
                      🚇 Near Transit
                    </span>
                  )}
                  {activeNaturalParsed.amenities?.map((a) => (
                    <span key={a} className="rounded-md bg-base-100 border border-primary/20 px-2 py-0.5 font-medium text-base-content capitalize">
                      ✨ {a}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveNaturalParsed(null);
                    setSearch("");
                  }}
                  className="btn btn-ghost btn-xs text-primary hover:bg-primary/20 font-semibold gap-1 h-auto min-h-0 py-1 px-2 rounded-lg shrink-0 ml-2"
                >
                  <X className="size-3" /> Clear
                </button>
              </div>
            )}

            <RoleBasedFilters
              userRole={activeRole}
              isOpen={isFiltersOpen}
              onClose={() => setIsFiltersOpen(false)}
              onApply={(filters) => setAppliedFilters(filters)}
              onReset={() => setAppliedFilters(filters)}
              onSaveSearch={saveSearchFromFilters}
            />

            {(pullDistance > 0 || pullRefreshing) && (
              <div
                className="flex items-center justify-center overflow-hidden text-primary"
                style={{ height: pullDistance }}
              >
                <RefreshCw
                  className={`size-5 ${pullRefreshing ? "animate-spin" : ""}`}
                  style={pullRefreshing ? undefined : { transform: `rotate(${(pullDistance / pullThreshold) * 270}deg)`, opacity: Math.min(1, pullDistance / pullThreshold) }}
                />
              </div>
            )}

            {hasNewPosts && (
              <div className="sticky top-2 z-10 mt-4 flex justify-center">
                <button
                  type="button"
                  onClick={handleShowNewPosts}
                  className="btn btn-sm gap-1.5 rounded-full border-none bg-primary text-white shadow-lg hover:bg-primary"
                >
                  <RefreshCw className="size-3.5" />
                  New posts available
                </button>
              </div>
            )}

            {isNearMe && !isLoading && nearMeInfo && (
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/70">
                <MapPin className="size-3.5 text-primary" />
                <span>{nearMeInfo}</span>
                {liveFreshness !== "fresh" && (
                  <button
                    type="button"
                    className="font-semibold text-primary hover:underline disabled:opacity-50"
                    disabled={liveLocStatus === "locating"}
                    onClick={() => refreshLocation()}
                  >
                    {liveLocStatus === "locating" ? "Updating…" : "Update location"}
                  </button>
                )}
              </div>
            )}

            {authUser?._id && <LocationPrompt />}
            <PreferencePrompt />

            {isLoading ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-[420px] animate-pulse rounded-2xl bg-base-200" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 p-8 text-center text-sm text-base-content/60">
                {isNearMe
                  ? liveLocStatus === "denied" && !liveLocation?.lat
                    ? "Location access is off and we have no saved location. Enable it in your browser, or use the search bar to pick a city."
                    : "No listings near you right now. Try a wider search or a specific city."
                  : "No listings found with current preferences."}
              </div>
            ) : (
              <>
              <div className="mt-4 grid gap-5 2xl:grid-cols-2">
                {feedItems.map((item, feedIndex) => {
                  if (item.type === "suggestion") {
                    return (
                      <FeedSuggestionCard
                        key={`suggestion-${item.suggestionType}-${item.data.id || item.data._id}`}
                        suggestionType={item.suggestionType}
                        data={item.data}
                        position={feedIndex}
                        onDismiss={handleSuggestionDismiss}
                      />
                    );
                  }

                  if (item.type === "ad") {
                    return (
                      <AdCard
                        key={`ad-${item.data._id}-${feedIndex}`}
                        ad={item.data}
                        position={feedIndex}
                        onDismiss={handleAdDismiss}
                      />
                    );
                  }

                  const post = item.post;
                  const badge = getListingBadge(post);
                  const postType = String(post.postType || "").toUpperCase();
                  const isFlatmate = postType === "FLATMATE_OFFER" || postType === "FLATMATE_SEEKING";
                  const isRequirement = postType.startsWith("REQUIREMENT_");
                  const requirementTitle = post.title || (postType === "REQUIREMENT_RENT" ? "Looking for Rental Property" : "Looking to Buy Property");

                  const priceContextBadges = isRequirement || isFlatmate ? [] : getPriceContextBadges(post);
                  const distPill = distancePill(post);

                  const handleDoubleClickMedia = (event) => {
                    event.stopPropagation();
                    toggleLike(post._id);
                    setLikedBurstPostId(post._id);
                    setTimeout(() => {
                      setLikedBurstPostId((current) => (current === post._id ? null : current));
                    }, 700);
                  };

                  const flatmateBadgeClass = postType === "FLATMATE_OFFER"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm"
                    : postType === "FLATMATE_SEEKING"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm"
                      : null;

                  return (
                    <PropertyPostCard
                      key={post._id}
                      post={post}
                      className={`${
                        isFlatmate ? (postType === "FLATMATE_OFFER" ? "ring-2 ring-success/30" : "ring-2 ring-warning/30") : ""
                      } ${selectedForComparison.includes(post._id) ? "border-primary ring-2 ring-primary/20" : "border-base-200"}`.trim()}
                      isOwnPost={Boolean(authUser?._id && post.author?._id && String(authUser._id) === String(post.author._id))}
                      onBoost={(p) => setBoostTargetPost(p)}
                      onEdit={(p, opts) => handleEditPost(p, opts)}
                      onVerifyAddress={(p) => setVerifyAddressTargetPost(p)}
                      media={post.media}
                      onDoubleClickMedia={handleDoubleClickMedia}
                      badge={isFlatmate ? (
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {badge}
                        </span>
                      ) : badge}
                      badgeClassName={
                        flatmateBadgeClass
                          ? flatmateBadgeClass
                          : post.offerStatus === "ACCEPTED"
                            ? "bg-neutral text-white"
                            : post.customBadge
                              ? getCustomBadgeClasses(post.customBadge)
                              : undefined
                      }
                      menu={
                        <button
                          type="button"
                          className="grid size-6 place-items-center rounded-full text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.6)] hover:opacity-75"
                          onClick={(event) => {
                            event.stopPropagation();
                            if (postMenuAnchor?.post._id === post._id) {
                              setPostMenuAnchor(null);
                              return;
                            }
                            const rect = event.currentTarget.getBoundingClientRect();
                            setPostMenuAnchor({
                              post,
                              top: rect.bottom + 4,
                              left: Math.max(8, rect.right - 144),
                            });
                          }}
                        >
                          <MoreVertical className="size-3.5" />
                        </button>
                      }
                      requirementBlock={
                        (!Array.isArray(post.mediaUrls) || post.mediaUrls.length === 0) && isFlatmate ? (
                          <div className={`flex h-[18rem] items-end p-4 text-white ${
                            postType === "FLATMATE_SEEKING"
                              ? "bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500"
                              : "bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500"
                          }`}>
                            <div>
                              <p className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide text-white/80">
                                <Users className="size-3.5" />
                                {postType === "FLATMATE_SEEKING" ? "Looking for Room" : "Room Available"}
                              </p>
                              <p className="mt-1 text-2xl font-black leading-tight">{post.title}</p>
                              <p className="mt-2 text-sm text-white/90">
                                {(() => {
                                  const fm = post.postMeta?.flatmate || {};
                                  const parts = [];
                                  if (fm.budgetMin || fm.budgetMax) parts.push(`Budget ${formatMoney(fm.budgetMax || fm.budgetMin)}/mo`);
                                  if (fm.roomType) parts.push(fm.roomType);
                                  if (post.locality || post.city) parts.push(post.locality || post.city);
                                  return parts.join(" · ") || "Flatmate post";
                                })()}
                              </p>
                            </div>
                          </div>
                        ) : (!Array.isArray(post.mediaUrls) || post.mediaUrls.length === 0) && isRequirement ? (
                          <div className="flex h-[18rem] items-end bg-gradient-to-br from-primary via-secondary to-info p-4 text-white">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-white/80">Requirement Post</p>
                              <p className="mt-1 text-2xl font-black leading-tight">{requirementTitle}</p>
                              <p className="mt-2 text-sm text-white/90">
                                {post.bedrooms || 0} BHK · Budget {formatMoney(post.price)} · {post.city || "Any city"}
                              </p>
                            </div>
                          </div>
                        ) : null
                      }
                      compareControl={
                        <CompareToggleButton
                          postId={post._id}
                          selected={selectedForComparison}
                          onToggle={(id) => setSelectedForComparison((prev) => toggleCompareSelection(prev, id))}
                        />
                      }
                      onShare={() => {
                        setPostToShare(post);
                        setShowShareModal(true);
                      }}
                      onFullscreen={(img) => setSelectedImage(img)}
                      mediaOverlay={
                        <>
                          {likedBurstPostId === post._id && (
                            <Heart className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-white/95 text-white drop-shadow-md animate-pulse" />
                          )}
                          {isFlatmate && Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0 && (() => {
                            const fm = post.postMeta?.flatmate || {};
                            const rent = postType === "FLATMATE_OFFER"
                              ? formatMoney(fm.rentPerPerson || post.price)
                              : fm.budgetMax ? `${formatMoney(fm.budgetMin || 0)} – ${formatMoney(fm.budgetMax)}` : null;
                            const infoParts = [fm.roomType, fm.genderPreference && fm.genderPreference !== "Any" ? fm.genderPreference : null].filter(Boolean);
                            return (
                              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-4 pb-10 pt-10">
                                <p className="text-lg font-black leading-tight text-white drop-shadow-sm">
                                  {rent}<span className="ml-1 text-xs font-normal text-white/70">/mo</span>
                                </p>
                                {infoParts.length > 0 && (
                                  <p className="mt-0.5 text-xs font-medium text-white/80">{infoParts.join(" · ")}</p>
                                )}
                              </div>
                            );
                          })()}
                        </>
                      }
                      contactLabel={isFlatmate ? "Message" : isRequirement ? "Respond" : "Contact seller"}
                      priceBlock={
                        isFlatmate ? (() => {
                          const fm = post.postMeta?.flatmate || {};
                          const isOfferType = postType === "FLATMATE_OFFER";
                          const priceText = isOfferType
                            ? formatMoney(fm.rentPerPerson || post.price)
                            : (fm.budgetMin && fm.budgetMax)
                              ? `${formatMoney(fm.budgetMin)} – ${formatMoney(fm.budgetMax)}`
                              : formatMoney(fm.budgetMax || post.price);

                          const infoPills = [];
                          if (fm.roomType) infoPills.push(fm.roomType + (fm.occupancy > 1 ? ` · ${fm.occupancy}-sharing` : ""));
                          if (fm.genderPreference && fm.genderPreference !== "Any") infoPills.push(`${fm.genderPreference} only`);
                          if (fm.furnishing) infoPills.push(fm.furnishing);
                          if (fm.depositAmount > 0) infoPills.push(`₹${fm.depositAmount.toLocaleString("en-IN")} deposit`);
                          if (fm.availableFrom) infoPills.push(`Move-in ${fm.availableFrom}`);
                          const loc = [post.locality, post.city].filter(Boolean).join(", ");
                          if (loc) infoPills.push(loc);

                          const tags = [...(fm.targetAudience || []), ...(fm.lifestyleTags || []), ...(fm.amenityTags || [])];

                          return (
                            <>
                              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <p className="inline-flex items-baseline text-[1.7rem] font-black leading-none text-base-content">
                                  {priceText}
                                  <span className="ml-1 text-sm font-normal text-base-content/50">/ mo</span>
                                </p>
                              </div>

                              {infoPills.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                  {infoPills.map((pill) => (
                                    <span
                                      key={pill}
                                      className="inline-flex items-center rounded-lg bg-base-200 px-2.5 py-0.5 text-[11px] font-medium text-base-content/70"
                                    >
                                      {pill}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {tags.length > 0 && (
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                  {tags.slice(0, 6).map((tag) => (
                                    <span
                                      key={tag}
                                      className="inline-flex items-center rounded-full border border-base-300 px-2 py-0.5 text-[10.5px] font-normal text-base-content/55"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                  {tags.length > 6 && (
                                    <span className="text-[10.5px] text-base-content/40">+{tags.length - 6}</span>
                                  )}
                                </div>
                              )}
                            </>
                          );
                        })() : (
                        <>
                          {/* Price + inline price-drop */}
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <p className="inline-flex items-baseline text-[1.7rem] font-black leading-none text-base-content">
                              {formatMoney(post.price)}
                              {activeRole === "Tenant" && <span className="ml-1 text-sm font-normal text-base-content/50">/ mo</span>}
                            </p>
                            {priceContextBadges
                              .filter((badge) => badge.key === "drop" || badge.key === "rise")
                              .slice(0, 1)
                              .map((badge) => (
                                <span
                                  key={badge.key}
                                  className={`text-sm font-bold ${badge.key === "rise" ? "text-error" : "text-success"}`}
                                >
                                  {badge.key === "rise" ? "↑" : "↓"}{" "}
                                  {badge.label.replace(/\s*price drop\s*/i, "").trim() || badge.label}
                                </span>
                              ))}
                          </div>

                          {/* Badges & Property Info Section */}
                          {(() => {
                            const isOwn = Boolean(authUser?._id && post.author?._id && String(authUser._id) === String(post.author._id));
                            const curatedBadges = getCuratedCardBadges(post, { isOwnPost: isOwn, max: 4 });
                            const curatedKeys = curatedBadges.map((b) => b.key);
                            const infoBadges = getPropertyInfoBadges(post, { distPill, existingKeys: curatedKeys, max: 8 });

                            if (curatedBadges.length === 0 && infoBadges.length === 0) return null;
                            return (
                              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                {curatedBadges.map((badge) => {
                                  if (badge.isAction && badge.action === "verifyAddress") {
                                    return (
                                      <button
                                        key={badge.key}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setVerifyAddressTargetPost(post);
                                        }}
                                        title="Verify address to boost reach"
                                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[11px] transition-all cursor-pointer shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${badge.className}`}
                                      >
                                        {badge.label}
                                      </button>
                                    );
                                  }
                                  const isSelected = activeBadgeFilter === (badge.filterValue || badge.label);
                                  return (
                                    <button
                                      key={badge.key}
                                      type="button"
                                      onClick={(e) => handleFilterByBadge(badge, e)}
                                      title={`Filter feed by "${badge.label}"`}
                                      className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-[11px] transition-all cursor-pointer shadow-xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0 active:scale-95 ${
                                        badge.className
                                      } ${
                                        isSelected
                                          ? "ring-2 ring-primary ring-offset-1 font-bold shadow-sm scale-105"
                                          : ""
                                      }`}
                                    >
                                      {badge.label}
                                    </button>
                                  );
                                })}

                                {infoBadges.map((info) => (
                                  <span
                                    key={info.key}
                                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-normal cursor-default select-none pointer-events-none ${info.className}`}
                                  >
                                    {info.icon === "MapPin" && <MapPin className="size-2.5 shrink-0" />}
                                    {(info.icon === "Navigation" || info.icon === "transit") && <Navigation className="size-2.5 shrink-0" />}
                                    {info.icon === "TrendingUp" && <TrendingUp className="size-2.5 shrink-0" />}
                                    {info.icon === "Target" && <Target className="size-2.5 shrink-0" />}
                                    {info.label}
                                  </span>
                                ))}
                              </div>
                            );
                          })()}

                          {post.postMeta?.moveInDate && activeRole === "Tenant" && (
                            <p className="text-[11px] text-base-content/50">
                              Move-in {new Date(post.postMeta.moveInDate).toLocaleDateString()}
                            </p>
                          )}
                        </>
                        )
                      }
                      description={
                        <ClampedCaption text={post.caption || post.title || "A beautifully curated property with modern design and premium amenities."} />
                      }
                      metaLine={
                        post.latitude && post.longitude ? (
                          <button
                            type="button"
                            className="font-semibold text-base-content/70 hover:text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/map-view?propertyId=${post._id}`);
                            }}
                          >
                            Live location
                          </button>
                        ) : null
                      }
                      onOpenLikes={() => setLikesModalPostId(post._id)}
                      onLike={() => toggleLike(post._id)}
                      isLiked={post.isLikedByMe}
                      likesCount={post.likesCount}
                      viewsCount={post.viewCount || 0}
                      onComment={() => setSelectedPostForComments(post)}
                      commentsCount={post.commentCount || 0}
                      onSave={() => toggleSave(post._id)}
                      isSaved={post.isSavedByMe}
                      savesCount={post.savesCount || 0}
                      onContact={() => handleContactClick(post)}
                      onOpenPost={() => navigate(`/property/${post._id}`)}
                    />
                  );
                })}
              </div>
              </>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-base-200 bg-base-100 overflow-hidden">
                      <div className="h-60 bg-base-300/60" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 w-3/4 rounded bg-base-300/60" />
                        <div className="h-3 w-1/2 rounded bg-base-300/40" />
                        <div className="flex gap-4 pt-2">
                          <div className="h-3 w-16 rounded bg-base-300/40" />
                          <div className="h-3 w-16 rounded bg-base-300/40" />
                          <div className="h-3 w-16 rounded bg-base-300/40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
              </>
            ) : (
              <>
                {/* Mobile-only section header — back + title, matching native app pattern */}
                {!(activeSection === "chat" || (activeSection === "communities" && selectedCommunity)) && (
                  <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-base-300 bg-base-100/95 backdrop-blur px-4 py-3 xl:hidden">
                    <button
                      type="button"
                      onClick={() => { searchParams.delete("section"); navigate("/marketplace", { replace: true }); }}
                      className="grid size-9 place-items-center rounded-full hover:bg-base-200 active:bg-base-300 transition-colors"
                      aria-label="Back to Marketplace"
                    >
                      <ArrowLeft className="size-5 text-base-content" />
                    </button>
                    <h1 className="text-lg font-bold text-base-content truncate">
                      {{ activity: "Activity", communities: "Communities", connections: "Connections & People", call: "Calls", profile: "Edit Profile" }[activeSection] || activeSection}
                    </h1>
                  </div>
                )}
                <Suspense fallback={<div className="flex items-center justify-center h-40 text-base-content/50 text-sm">Loading…</div>}>
                  {activeSection === "activity" ? (
                    <ActivityContent onNavigateToPost={(postId) => {
                      navigate(`/property/${postId}`);
                    }} />
                  ) : activeSection === "communities" ? (
                    selectedCommunity ? (
                      <CommunityChat
                        community={selectedCommunity}
                        onBack={() => setSelectedCommunity(null)}
                        autoJoinCall={autoJoinCall && String(selectedCommunity?._id) === String(deepLinkCircleId)}
                        autoJoinCallId={autoJoinCallId}
                      />
                    ) : (
                      <CommunitiesContent
                        onOpenChat={(community) => setSelectedCommunity(community)}
                      />
                    )
                  ) : activeSection === "chat" ? (
                    <ChatContent deepLinkUserId={searchParams.get("userId")} />
                  ) : activeSection === "connections" ? (
                    <ConnectionsContent onOpenMessages={() => setActiveSection("chat")} />
                  ) : activeSection === "call" ? (
                    <CallContent />
                  ) : activeSection === "profile" ? (
                    <ProfileContent />
                  ) : null}
                </Suspense>
              </>

            )}
          </main>

          {activeSection === "marketplace" ? (
            <aside className="hidden w-[320px] rounded-2xl border border-base-200 bg-base-200/90 p-4 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="flex items-center gap-1 text-sm font-bold text-base-content">
                    <Flame className="size-3.5 text-primary" /> Trending Near You
                  </p>
                  <p className="text-[10px] text-base-content/50">
                    {liveLocation?.lat ? "Ranked from your live location" : "Gaining interest close to you"}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-xs border border-base-300 bg-base-100 text-primary hover:bg-primary/10"
                  onClick={() => navigate("/trending-near-you")}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {trendingNearYou.length > 0 ? (
                  trendingNearYou.slice(0, 4).map((post) => (
                    <button
                      key={post.id}
                      type="button"
                      onClick={() => navigate(`/property/${post.id}`)}
                      className="flex w-full items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-2 text-left hover:bg-base-200"
                    >
                      <img
                        src={post.coverImage || "https://placehold.co/64x64?text=NMS"}
                        alt={post.title}
                        className="size-11 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-xs font-semibold text-base-content">{post.title}</p>
                          <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                            {post.trendingScore}%
                          </span>
                        </div>
                        <p className="truncate text-[11px] text-base-content/60">
                          {formatMoney(post.price)}
                          {post.distanceKm != null ? ` · ${post.distanceKm} km away` : post.city ? ` · ${post.city}` : ""}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-base-content/60 text-center py-2">No trending properties near you yet</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-base-content">
                    {userCity ? `Trending in ${userCity}` : "Trending News"}
                  </p>
                  <p className="text-[10px] text-base-content/50">Local property & infra updates</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle btn-xs text-base-content/60 hover:text-primary hover:bg-primary/10"
                    onClick={() => refetchNews()}
                    disabled={newsLoading}
                    title="Refresh news"
                  >
                    <RefreshCw className={`size-3.5 ${newsLoading ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs border border-base-300 bg-base-100 text-primary hover:bg-primary/10"
                    onClick={() => navigate(`/news${userCity ? `?city=${encodeURIComponent(userCity)}` : ""}`)}
                  >
                    View all
                  </button>
                </div>
              </div>
              {newsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-base-300 overflow-hidden">
                      <div className="w-full h-24 bg-base-300 animate-pulse" />
                      <div className="p-2 space-y-2">
                        <div className="h-3 bg-base-300 rounded animate-pulse" />
                        <div className="h-2 w-20 bg-base-300 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {newsData?.slice(0, 3).map((news) => (
                    <a
                      key={news.id}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-base-300 overflow-hidden hover:border-primary/30 hover:shadow-sm transition"
                    >
                      <img
                        src={news.image}
                        alt={news.title}
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs font-semibold text-base-content line-clamp-2">{news.title}</p>
                        <p className="mt-1 text-[10px] text-base-content/60">{news.source?.name || news.source || "Unknown"}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-base-content">Recommended for You</p>
                <button
                  type="button"
                  className="btn btn-xs border border-base-300 bg-base-100 text-primary hover:bg-primary/10"
                  onClick={() => navigate("/recommended")}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {personalizedRecommendations.filter((p) => !dismissedRecs.has(String(p._id))).length > 0 ? (
                  personalizedRecommendations
                    .filter((p) => !dismissedRecs.has(String(p._id)))
                    .slice(0, 3)
                    .map((post, i) => (
                    <div key={`rec-${post._id}`} className="group flex items-center gap-1 rounded-lg border border-base-300 p-2 hover:bg-base-200">
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        onClick={() => {
                          trackRecoEvent({ post: String(post._id), event: "click", position: i, context: "sidebar", scores: { personalization: post.personalizationScore, final: post.finalScore } });
                          navigate(`/property/${post._id}`);
                        }}
                      >
                        <img src={post.mediaUrls?.[0] || post.media?.[0]} alt={post.title || "Recommendation"} className="h-12 w-16 rounded-md object-cover" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-semibold text-base-content">{post.title || "Property"}</p>
                            {Math.round(post.personalizationScore) >= 55 && (
                              <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                {Math.round(post.personalizationScore)}%
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] text-base-content/60">{formatMoney(post.price)} · {post.city || "India"}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-circle text-base-content/30 opacity-0 transition group-hover:opacity-100 hover:text-error"
                        aria-label="Not interested"
                        onClick={() => {
                          trackRecoEvent({ post: String(post._id), event: "dismiss", reason: "not_interested", context: "sidebar" });
                          setDismissedRecs((prev) => new Set(prev).add(String(post._id)));
                          setTimeout(() => queryClient.invalidateQueries({ queryKey: ["personalizedRecommendations"] }), 400);
                        }}
                      >
                        <ThumbsDown className="size-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-base-content/60 text-center py-2">No recommendations yet</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-base-content">Trending Locations</p>
                <TrendingUp className="size-4 text-base-content/50" />
              </div>
              <div className="space-y-2">
                {trendingLocations.length > 0 ? (
                  trendingLocations.map((location) => (
                    <button
                      key={location.name}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-lg border p-2 text-left transition ${
                        selectedTrendingLocation === location.name
                          ? "border-primary bg-primary/10"
                          : "border-base-300 hover:bg-base-200"
                      }`}
                      onClick={() => {
                        if (selectedTrendingLocation === location.name) {
                          setSelectedTrendingLocation(null);
                          setSearch("");
                        } else {
                          setSelectedTrendingLocation(location.name);
                          setSearch(location.name);
                        }
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className={`size-3 ${selectedTrendingLocation === location.name ? "text-primary" : "text-base-content/50"}`} />
                        <p className={`text-xs font-semibold ${selectedTrendingLocation === location.name ? "text-primary" : "text-base-content"}`}>{location.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {location.isNearUser && (
                          <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">Near You</span>
                        )}
                        <span className="text-[11px] text-base-content/60">{location.propertyCount} properties</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-base-content/60 text-center py-2">No trending locations yet</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-base-300 bg-base-100 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-base-content">Role Snapshot</p>
                <Eye className="size-4 text-base-content/50" />
              </div>
              <div className="space-y-2">
                {roleWidgets.map((widget) => (
                  <div key={widget.title} className="rounded-lg border border-base-300 p-2">
                    <p className="text-[11px] text-base-content/60">{widget.title}</p>
                    <p className="text-lg font-black text-base-content">{widget.value}</p>
                    <p className="text-[11px] text-success">{widget.hint}</p>
                  </div>
                ))}
              </div>
            </div>
          </aside>
          ) : null}
        </div>
      </div>

      {/* AppShell's own shared bottom nav (mirroring LEFT_NAV_ITEMS) now covers
          mobile navigation here too, so this page no longer needs its own
          duplicate nav — same component renders identically on every page. */}

      {activeSection === "marketplace" && (
        <>
          <button
            type="button"
            className="btn btn-circle fixed bottom-24 right-5 z-40 h-14 w-14 border-none bg-primary text-white shadow-xl hover:bg-primary xl:hidden"
            onClick={() => {
              resetComposer();
              setIsComposerOpen(true);
            }}
          >
            <Plus className="size-6" />
          </button>
          <ScrollTopButton className="bottom-40 right-6 xl:bottom-8 xl:right-8" />
        </>
      )}

      <CompareFloatingBar selected={selectedForComparison} />

      {selectedImage && (
        <Suspense fallback={null}>
          <FullscreenMediaViewer src={selectedImage} onClose={() => setSelectedImage(null)} />
        </Suspense>
      )}

      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35" onClick={resetComposer}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-5xl overflow-y-auto border-l border-base-300 bg-base-100" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {editingDraftId ? <Edit3 className="size-4" /> : <Sparkles className="size-4" />}
                    {editingDraftId ? "Edit Post" : "Create Post"}
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-base-content">
                    {showDraftsList
                      ? "Your Drafts"
                      : composerResult
                        ? (composerResult === "DRAFT" ? "Saved as draft" : editingDraftId ? "Post updated" : "Post published")
                        : editingDraftId
                          ? `${stepKey === "details" ? "Edit Details" : stepKey === "photos" ? "Update Media" : stepKey === "review" ? "Review & Update" : "Edit Post"} (Step ${composerStep} of ${totalComposerSteps})`
                          : `Step ${composerStep} of ${totalComposerSteps}`}
                  </h3>
                  {!showDraftsList && !composerResult && autosaveState !== "idle" && (
                    <p className="mt-1 text-xs text-base-content/50">
                      {autosaveState === "saving" ? "Saving draft…" : "Draft saved"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {stepKey === "type" && !showDraftsList && !composerResult && (
                    <button
                      type="button"
                      className="btn btn-sm rounded-full border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                      onClick={() => setShowDraftsList(true)}
                    >
                      <Edit3 className="size-4" />
                      Drafts{draftsList.length > 0 ? ` (${draftsList.length})` : ""}
                    </button>
                  )}
                  {showDraftsList && (
                    <button
                      type="button"
                      className="btn btn-sm rounded-full border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                      onClick={() => setShowDraftsList(false)}
                    >
                      Back
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={resetComposer}><X className="size-4" /></button>
                </div>
              </div>
              {!showDraftsList && !composerResult && (
                <progress className="progress progress-primary mt-3 h-2 w-full" value={composerStep} max={totalComposerSteps} />
              )}
            </div>

            <div className="px-6 py-5">
              {showDraftsList ? (
                <div>
                  {isDraftsListLoading ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="h-20 animate-pulse rounded-2xl bg-base-200" />
                      ))}
                    </div>
                  ) : draftsList.length === 0 ? (
                    <div className="rounded-2xl border border-base-300 bg-base-200 p-10 text-center">
                      <Edit3 className="mx-auto size-8 text-base-content/40" />
                      <p className="mt-3 text-sm font-semibold text-base-content">No drafts yet</p>
                      <p className="mt-1 text-sm text-base-content/60">Save a post as a draft to pick up where you left off.</p>
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {draftsList.map((post) => {
                        const image = Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null;
                        return (
                          <div key={post._id} className="flex items-center gap-3 rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm">
                            <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-base-200">
                              {image ? (
                                <img src={image} alt={post.title || "Draft"} className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-base-content">{post.title || "Untitled draft"}</p>
                              <p className="text-xs text-base-content/60">{formatMoney(post.price)}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <button
                                type="button"
                                className="btn btn-xs rounded-lg border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                                onClick={() => resumeDraft(post)}
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                className="btn btn-xs btn-circle border-none text-error hover:bg-error/10"
                                disabled={deletingDraft}
                                onClick={() => setDraftToDelete(post)}
                                title="Delete draft"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : composerResult ? (
                <div className="rounded-2xl border border-success/30 bg-success/10 p-6 text-center">
                  <p className="text-2xl font-black text-success">
                    {composerResult === "DRAFT" ? "Saved as Draft" : "Post Published"}
                  </p>
                  <p className="mt-2 text-sm text-base-content/70">
                    {composerResult === "DRAFT"
                      ? "Find it under My Drafts on your profile whenever you're ready to publish."
                      : "Your post is now live and visible at the top of your marketplace feed."}
                  </p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        resetComposer();
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="btn btn-sm rounded-xl border-none bg-primary px-5 font-bold text-white shadow-none hover:bg-primary/90"
                    >
                      View in Feed
                    </button>
                  </div>
                </div>
              ) : stepKey === "type" ? (
                <div>
                  <p className="text-sm font-semibold text-base-content/70">What would you like to post? Recommended for {activeRole}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {recommendedPostTypes.map((postType) => {
                      const definition = POST_TYPE_DEFINITIONS[postType] || POST_TYPE_DEFINITIONS.PROPERTY_SALE;
                      const isActive = draft.postType === postType;
                      return (
                      <button
                        key={postType}
                        type="button"
                        className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-primary bg-primary/10" : "border-base-300 bg-base-100 hover:border-primary/30"}`}
                        onClick={() => {
                          setDraft((prev) => ({
                            ...prev,
                            postType,
                            listingType: definition.listingType,
                            propertyType: definition.propertyType,
                          }));
                        }}
                      >
                        <p className="font-semibold text-base-content">{definition.label}</p>
                        <p className="mt-1 text-xs text-base-content/60">{definition.description}</p>
                      </button>
                      );
                    })}
                  </div>

                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-base-content/60">Other Post Types</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {availablePostTypes
                      .filter((postType) => !recommendedPostTypes.includes(postType))
                      .map((postType) => {
                        const definition = POST_TYPE_DEFINITIONS[postType] || POST_TYPE_DEFINITIONS.PROPERTY_SALE;
                        const isActive = draft.postType === postType;
                        return (
                          <button
                            key={postType}
                            type="button"
                            className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-primary bg-primary/10" : "border-base-300 bg-base-100 hover:border-primary/30"}`}
                            onClick={() => {
                              setDraft((prev) => ({
                                ...prev,
                                postType,
                                listingType: definition.listingType,
                                propertyType: definition.propertyType,
                              }));
                            }}
                          >
                            <p className="font-semibold text-base-content">{definition.label}</p>
                            <p className="mt-1 text-xs text-base-content/60">{definition.description}</p>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {stepKey === "photos" && !composerResult ? (
                <div>
                  <p className="text-sm font-semibold text-base-content/70">Upload media (Max 5 files)</p>
                  <div
                    className={`mt-4 rounded-2xl border border-dashed border-base-300 bg-base-200 p-6 text-center transition ${
                      isUploadingMedia ? "" : "hover:border-primary hover:bg-primary/10"
                    }`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (isUploadingMedia) return;
                      const files = Array.from(e.dataTransfer.files);
                      const validFiles = files.filter((file) => {
                        const isImage = file.type.startsWith("image/");
                        const isVideo = file.type.startsWith("video/");
                        return isImage || isVideo;
                      });
                      if (validFiles.length > 0) {
                        const currentCount = composerMedia.length;
                        const remainingSlots = 5 - currentCount;
                        const filesToUpload = validFiles.slice(0, remainingSlots);
                        if (filesToUpload.length < validFiles.length) {
                          toast.error(`Can only upload ${remainingSlots} more files (max 5 total)`);
                        }
                        uploadMedia(filesToUpload);
                      }
                    }}
                  >
                    {isUploadingMedia ? (
                      <>
                        <Loader2 className="mx-auto size-8 animate-spin text-primary" />
                        <p className="mt-2 text-sm font-semibold text-base-content">Uploading… {mediaUploadProgress}%</p>
                        <div className="mx-auto mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-base-300">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${mediaUploadProgress}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="mx-auto size-8 text-base-content/50" />
                        <p className="mt-2 text-sm text-base-content/70">Drag photos/videos here or click to browse</p>
                        <p className="mt-1 text-xs text-base-content/60">Supports: PNG, JPEG, WEBP, GIF, MP4, WEBM, MOV (Max 50MB per file)</p>
                        {String(draft.postType || "").startsWith("REQUIREMENT_") ? (
                          <p className="mt-1 text-xs text-base-content/60">Media is optional for requirement posts.</p>
                        ) : null}
                        <input
                          type="file"
                          multiple
                          accept="image/*,video/*"
                          className="hidden"
                          id="media-upload"
                          onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            const currentCount = composerMedia.length;
                            const remainingSlots = 5 - currentCount;
                            const filesToUpload = files.slice(0, remainingSlots);
                            if (filesToUpload.length < files.length) {
                              toast.error(`Can only upload ${remainingSlots} more files (max 5 total)`);
                            }
                            uploadMedia(filesToUpload);
                            e.target.value = "";
                          }}
                        />
                        <label htmlFor="media-upload" className="btn btn-sm btn-primary mt-3">
                          Browse Files
                        </label>
                      </>
                    )}
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-base-content/60 mb-2">Uploaded media ({composerMedia.length}/5):</p>
                    {composerMedia.length ? (
                      <div className="flex flex-wrap gap-2">
                        {composerMedia.map((url, idx) => {
                          const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
                          return (
                            <div key={idx} className="relative">
                              {isVideo ? (
                                <video src={url} className="size-16 rounded-lg object-cover border border-base-300" muted />
                              ) : (
                                <img src={url} alt={`Upload ${idx + 1}`} className="size-16 rounded-lg object-cover border border-base-300" />
                              )}
                              <button
                                type="button"
                                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-error text-white text-xs leading-none shadow"
                                onClick={() => {
                                  const urls = composerMedia.filter((_, i) => i !== idx);
                                  setDraft((prev) => ({ ...prev, mediaUrls: urls.join(",") }));
                                }}
                              >
                                ×
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-base-content/60">No media selected yet.</span>
                    )}
                  </div>
                </div>
              ) : null}

              {stepKey === "details" && !composerResult ? (
                <div>
                  <p className="text-sm font-semibold text-base-content/70">Add intent-specific details</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-base-content/60">Title</span>
                      <input className="input input-bordered border-base-300" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-base-content/60">Location (Optional)</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                          onClick={() => {
                            if (!navigator.geolocation) {
                              toast.error("Geolocation is not supported by your browser");
                              return;
                            }
                            navigator.geolocation.getCurrentPosition(
                              async (position) => {
                                const { latitude, longitude } = position.coords;
                                try {
                                  const { city, locality } = await reverseGeocode(latitude, longitude);
                                  setDraft(prev => ({
                                    ...prev,
                                    city: city || prev.city,
                                    locality: locality || prev.locality,
                                    latitude,
                                    longitude,
                                  }));
                                  toast.success("Location captured successfully");
                                } catch {
                                  setDraft(prev => ({ ...prev, latitude, longitude }));
                                  toast.success("Coordinates captured (city/locality not found)");
                                }
                              },
                              () => {
                                toast.error("Failed to get location. Please allow location access.");
                              }
                            );
                          }}
                        >
                          <MapPin className="size-4" />
                          Use My Current Location
                        </button>
                      </div>
                    </label>
                    <div className="form-control">
                      <label className="label-text mb-1 text-xs text-base-content/60">City / Location</label>
                      <div className="relative">
                          <input
                            type="text"
                            className="input input-bordered border-base-300 w-full"
                            value={draft.city}
                            onChange={(event) => {
                              const query = event.target.value;
                              
                              // Clear locality when city changes
                              setDraft(prev => ({ 
                                ...prev, 
                                city: query,
                                locality: query !== prev.city ? "" : prev.locality
                              }));
                              
                              // Clear previous timeout
                              if (geocodeTimeoutRef.current) {
                                clearTimeout(geocodeTimeoutRef.current);
                              }
                              
                              if (query.length >= 2) {
                                setLoadingSuggestions(true);
                                // Add debounce to prevent rate limiting
                                geocodeTimeoutRef.current = setTimeout(() => {
                                  // Nominatim sends Access-Control-Allow-Origin: *, so this
                                  // can be called directly from the browser — no CORS proxy
                                  // needed (a prior version routed through corsproxy.io,
                                  // which is no longer functional).
                                  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`, {
                                    headers: { "Accept-Language": "en" },
                                  })
                                    .then(res => {
                                      if (!res.ok) throw new Error('Rate limited');
                                      return res.json();
                                    })
                                    .then(data => {
                                      if (data && data.length > 0) {
                                        setCitySuggestions(data.map(item => ({
                                          display: item.display_name,
                                          city: item.address.city || item.address.town || item.address.village || item.address.municipality || query,
                                          lat: parseFloat(item.lat),
                                          lon: parseFloat(item.lon)
                                        })));
                                      } else {
                                        // No results found
                                        setCitySuggestions([{
                                          display: `No results found for "${query}" - use map to set location`,
                                          city: query,
                                          lat: null,
                                          lon: null,
                                          isManual: true
                                        }]);
                                      }
                                      setLoadingSuggestions(false);
                                    })
                                    .catch(() => {
                                      // Fallback: show manual coordinate entry option
                                      setCitySuggestions([{
                                        display: `Use map to set location for "${query}"`,
                                        city: query,
                                        lat: null,
                                        lon: null,
                                        isManual: true
                                      }]);
                                      setLoadingSuggestions(false);
                                    });
                                }, 800); // 800ms debounce to be safer
                              } else {
                                setCitySuggestions([]);
                                setLoadingSuggestions(false);
                              }
                            }}
                            placeholder="Type city or location..."
                          />
                        {citySuggestions.length > 0 && (
                          <div className="absolute z-[9999] w-full mt-1 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {citySuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-base-200 border-b border-base-200 last:border-b-0"
                                onClick={() => {
                                  if (suggestion.isManual) {
                                    // For manual entry, just set the city and show map without coordinates
                                    setDraft(prev => ({
                                      ...prev,
                                      city: suggestion.city,
                                    }));
                                    toast.info("Please use the map to set your exact location");
                                  } else {
                                    setDraft(prev => ({
                                      ...prev,
                                      city: suggestion.city,
                                      latitude: suggestion.lat,
                                      longitude: suggestion.lon,
                                    }));
                                  }
                                  setCitySuggestions([]);
                                }}
                              >
                                <div className="text-sm font-medium text-base-content">{suggestion.city}</div>
                                <div className="text-xs text-base-content/60 truncate">{suggestion.display}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs text-base-content/60">Locality</span>
                      <input className="input input-bordered border-base-300" value={draft.locality} onChange={(event) => updateDraft("locality", event.target.value)} />
                    </label>
                    <div className="sm:col-span-2">
                      <div className="relative h-64 rounded-lg overflow-hidden bg-base-200 border border-base-300">
                        <Suspense fallback={<div className="flex items-center justify-center h-full text-base-content/50 text-sm">Loading map…</div>}>
                          <LazyLocationPicker
                            key={draft.latitude && draft.longitude ? `${draft.latitude}-${draft.longitude}` : "default"}
                            center={draft.latitude && draft.longitude ? [draft.latitude, draft.longitude] : DEFAULT_MAP_CENTER}
                            zoom={draft.latitude && draft.longitude ? 13 : 5}
                            position={draft.latitude && draft.longitude ? [draft.latitude, draft.longitude] : DEFAULT_MAP_CENTER}
                            onPositionChange={handleMapPositionChange}
                            mapRef={mapRef}
                          />
                        </Suspense>
                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs text-base-content/70">
                          Click or drag pin to set location
                        </div>
                      </div>
                      {draft.latitude && draft.longitude ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-base-content/60">
                          <MapPin className="size-3" />
                          <span>Coordinates: {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</span>
                          <button
                            type="button"
                            className="text-error hover:text-error"
                            onClick={() => setDraft(prev => ({ ...prev, latitude: null, longitude: null }))}
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-base-content/60">Click or drag the pin on the map to set the exact location.</p>
                      )}
                    </div>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-base-content/60">Description</span>
                      <textarea className="textarea textarea-bordered min-h-20 border-base-300" value={draft.caption} onChange={(event) => updateDraft("caption", event.target.value)} />
                    </label>

                    <div className="sm:col-span-2">
                      <PostTypeFields
                        postType={draft.postType}
                        draft={draft}
                        updateDraft={updateDraft}
                        priceLabel={getPostTypeConfig(draft.postType).priceLabel}
                      />
                      {!String(draft.postType || "").toUpperCase().startsWith("REQUIREMENT_") && <PriceSuggestion draft={draft} />}
                    </div>
                  </div>
                </div>
              ) : null}

              {stepKey === "review" && !composerResult ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-base-content/70">Review &amp; publish</p>
                      <p className="text-xs text-base-content/50">Here is how your post will look in the marketplace feed</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      Live Feed Preview
                    </span>
                  </div>

                  <div className="mt-4 flex justify-center">
                    <div className="w-full max-w-md">
                      <PropertyPostCard
                        post={previewPost}
                        media={previewPost.media}
                        badge={getListingBadge(draft)}
                        isOwnPost={true}
                        priceBlock={
                          <div>
                            <span className="text-xl font-black text-base-content">
                              {formatMoney(draft.price)}
                            </span>
                            {draft.listingType === "Rent" && (
                              <span className="text-xs text-base-content/60"> /month</span>
                            )}
                          </div>
                        }
                        description={
                          draft.caption ? (
                            <p className="mt-1 text-sm text-base-content/80 line-clamp-2">
                              {draft.caption}
                            </p>
                          ) : null
                        }
                      />
                    </div>
                  </div>

                  <p className="mt-4 text-center text-xs text-base-content/60">
                    Publishing makes this post immediately visible in the marketplace feed. Save as a draft to finish later.
                  </p>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-between">
                {composerResult ? (
                  <button type="button" className="btn border-none bg-primary text-white hover:bg-primary ml-auto" onClick={resetComposer}>Done</button>
                ) : showDraftsList ? null : (
                  <>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={composerStep === 1}
                      onClick={() => setComposerStep((prev) => Math.max(1, prev - 1))}
                    >
                      Back
                    </button>

                    {stepKey === "review" ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline"
                          disabled={creating}
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, status: "DRAFT" }));
                            createPost("DRAFT");
                          }}
                        >
                          Save as Draft
                        </button>
                        <button
                          type="button"
                          className="btn border-none bg-primary text-white hover:bg-primary"
                          disabled={creating}
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, status: "PUBLISHED" }));
                            createPost("PUBLISHED");
                          }}
                        >
                          <Send className="size-4" />
                          {creating ? "Publishing..." : "Publish"}
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {editingDraftId && (
                          <button
                            type="button"
                            className="btn btn-outline btn-primary"
                            disabled={creating || !stepValid}
                            onClick={() => {
                              createPost(draft.status || "PUBLISHED");
                            }}
                          >
                            {creating ? "Saving…" : "Save Changes"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn border-none bg-primary text-white hover:bg-primary"
                          disabled={!stepValid}
                          onClick={() => setComposerStep((prev) => Math.min(totalComposerSteps, prev + 1))}
                        >
                          {stepKey === "photos" && composerMedia.length === 0 && !getPostTypeConfig(draft.postType).requiresMedia
                            ? "Skip for now"
                            : "Next"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {draftToDelete ? (
        <Suspense fallback={null}>
          <ConfirmDeleteModal
            title="Delete this draft?"
            description={`"${draftToDelete.title || "Untitled draft"}" will be permanently deleted. This can't be undone.`}
            isPending={deletingDraft}
            onConfirm={() => deleteDraft(draftToDelete._id)}
            onClose={() => setDraftToDelete(null)}
          />
        </Suspense>
      ) : null}

      {selectedPostForComments ? (
        <CommentSection
          post={selectedPostForComments}
          onClose={() => setSelectedPostForComments(null)}
        />
      ) : null}

      {/* Contact Modal */}
      {contactModalOpen && selectedPostForContact && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setContactModalOpen(false)}>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md" onClick={(event) => event.stopPropagation()}>
            <div className="rounded-2xl bg-base-100 p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-base-content">Contact Owner</h3>
                <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setContactModalOpen(false)}>
                  <X className="size-4" />
                </button>
              </div>

              {/* Property Summary */}
              <div className="rounded-xl bg-base-200 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="size-16 rounded-lg overflow-hidden bg-base-300 flex-shrink-0">
                    {selectedPostForContact.media?.[0] ? (
                      <img
                        src={selectedPostForContact.media[0]}
                        alt="Property"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center text-base-content/50">
                        <Building2 className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base-content line-clamp-1">{selectedPostForContact.title || "Property"}</p>
                    <p className="text-sm text-base-content/70 line-clamp-1">{selectedPostForContact.bedrooms || 0} BHK • {Number(selectedPostForContact.areaSqft || 0)} sqft</p>
                    <p className="text-sm font-bold text-primary">{formatMoney(selectedPostForContact.price)}</p>
                  </div>
                </div>
              </div>

              {/* Pre-filled message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-base-content mb-2">Your Message</label>
                <textarea
                  ref={contactMessageRef}
                  className="textarea textarea-bordered w-full h-24 text-sm"
                  placeholder={`Hi ${selectedPostForContact.author?.fullName?.split(" ")[0] || "there"},\n\nI'm interested in this property. Please share more details.`}
                  defaultValue={`Hi ${selectedPostForContact.author?.fullName?.split(" ")[0] || "there"},\n\nI'm interested in this property. Please share more details.`}
                />
              </div>

              {/* Quick Actions */}
              <div className="mb-4">
                <p className="text-xs font-medium text-base-content/60 mb-2">Quick Actions</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Interested",
                    "Schedule Visit",
                    "Is Price Negotiable?",
                    "Need Video Tour",
                    "Available?",
                    "Call Me",
                  ].map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="btn btn-xs border border-base-300 bg-base-100 text-base-content hover:bg-base-200"
                      onClick={() => {
                        if (contactMessageRef.current) {
                          contactMessageRef.current.value = `Hi ${selectedPostForContact.author?.fullName?.split(" ")[0] || "there"},\n\n${action}`;
                        }
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>

              {/* Send Button */}
              <button
                type="button"
                className="btn w-full border-none bg-primary text-white hover:bg-primary"
                onClick={() => {
                  const message = contactMessageRef.current?.value || "";
                  console.log("Send button clicked, message:", message);
                  handleSendContactMessage(message);
                }}
              >
                <Send className="size-4" />
                Send Message
              </button>

              <p className="mt-3 text-center text-xs text-base-content/60">
                Your message will be sent as a request. The owner can accept, ignore, or block.
              </p>
            </div>
          </div>
        </div>
      )}

      <Suspense fallback={null}>
        {showShareModal && (
          <ShareModal
            isOpen={showShareModal}
            onClose={() => {
              setShowShareModal(false);
              setPostToShare(null);
            }}
            postUrl={postToShare ? `${window.location.origin}/p/${postToShare._id}` : ""}
            postTitle={postToShare?.title || "Property"}
            postId={postToShare?._id}
            postImage={postToShare ? normalizeMedia(postToShare)[0] : ""}
          />
        )}

        {likesModalPostId && (
          <PostLikesModal
            postId={likesModalPostId}
            open={Boolean(likesModalPostId)}
            onClose={() => setLikesModalPostId(null)}
          />
        )}

        {reportTargetPost && (
          <ReportPostModal
            isOpen={Boolean(reportTargetPost)}
            isPending={isReportPending}
            isSubmitted={reportSubmitted}
            onCancel={() => setReportTargetPost(null)}
            onConfirm={({ reasonCode, description }) =>
              submitPostReport({ postId: reportTargetPost._id, reasonCode, description })
            }
            onDone={() => {
              setReportTargetPost(null);
              setReportSubmitted(false);
            }}
          />
        )}

        {boostTargetPost && (
          <BoostPropertyModal
            isOpen={Boolean(boostTargetPost)}
            post={boostTargetPost}
            onClose={() => setBoostTargetPost(null)}
          />
        )}

        {verifyAddressTargetPost && (
          <VerifyAddressModal
            isOpen={Boolean(verifyAddressTargetPost)}
            post={verifyAddressTargetPost}
            onClose={() => setVerifyAddressTargetPost(null)}
          />
        )}
      </Suspense>

      {postMenuAnchor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPostMenuAnchor(null)} />
            <div
              className="fixed z-50 w-44 rounded-xl border border-base-300 bg-base-100 py-1 shadow-lg"
              style={{ top: postMenuAnchor.top, left: postMenuAnchor.left }}
            >
              {String(authUser?._id) === String(postMenuAnchor.post.author?._id) ? (
                <>
                  {!postMenuAnchor.post.isBlocked && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setBoostTargetPost(postMenuAnchor.post);
                          setPostMenuAnchor(null);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Zap className="size-3.5 fill-amber-500 text-amber-500" />
                        {postMenuAnchor.post.isBoosted ? "Boosted (Active)" : "Boost listing (1 coin)"}
                      </button>
                      <div className="border-t border-base-200" />
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      handleEditPost(postMenuAnchor.post);
                      setPostMenuAnchor(null);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-base-content hover:bg-base-200"
                  >
                    <Edit3 className="size-3.5" />
                    Edit
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setReportTargetPost(postMenuAnchor.post);
                    setPostMenuAnchor(null);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-error hover:bg-error/10"
                >
                  <Flag className="size-3.5" />
                  Report
                </button>
              )}
            </div>
          </>,
          document.body
        )}
    </AppShell>
  );
}
