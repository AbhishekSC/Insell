import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
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
  Heart,
  Home,
  IndianRupee,
  Loader2,
  Map,
  MapPin,
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
  TrendingUp,
  Upload,
  UserCircle,
  UserRoundPlus,
  Users,
  X,
} from "lucide-react";
import ShareModal from "../components/ShareModal";
import PropertyPostCard from "../components/PropertyPostCard";
import ClampedCaption from "../components/ClampedCaption";
import CompareToggleButton from "../components/CompareToggleButton";
import CompareFloatingBar from "../components/CompareFloatingBar";
import FullscreenMediaViewer from "../components/FullscreenMediaViewer";
import { buildPropertyDetailBadges } from "../lib/propertyDetailBadges";
import PostTypeFields from "../components/PostTypeFields";
import { getPostTypeConfig, META_ONLY_FIELDS } from "../config/postTypeConfig";
import { toggleCompareSelection } from "../lib/compareSelection";
import ReportPostModal from "../components/ReportPostModal";
import { getCustomBadgeClasses } from "../lib/badgeColors";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import CommentSection from "../components/CommentSection";
import ChatContent from "../components/ChatContent";
import ConnectionsContent from "../components/ConnectionsContent";
import CallContent from "../components/CallContent";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import ProfileContent from "../components/ProfileContent";
import ConfirmDeleteModal from "../components/ConfirmDeleteModal";
import ActivityContent from "../components/ActivityContent";
import CommunitiesContent from "../components/CommunitiesContent";
import CommunityChat from "../components/CommunityChat";
import RoleBasedPropertyCard from "../components/RoleBasedPropertyCard";
import RoleBasedFilters from "../components/RoleBasedFilters";
import StoriesBar from "../components/StoriesBar";
import RoleBasedDashboard from "../components/RoleBasedDashboard";
import axiosInstance from "../lib/axios";
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
  Tenant: ["REQUIREMENT_RENT"],
  Student: ["REQUIREMENT_RENT"],
  Seller: ["PROPERTY_SALE"],
  Landlord: ["PROPERTY_RENT"],
  Broker: ["PROPERTY_SALE", "PROPERTY_RENT", "REQUIREMENT_BUY", "REQUIREMENT_RENT"],
  Builder: ["BUILDER_PROJECT"],
};

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
];

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
  const [activeCategory, setActiveCategory] = useState("For You");
  const [selectedTrendingLocation, setSelectedTrendingLocation] = useState(null);
  const [carouselIndex, setCarouselIndex] = useState({});
  const [likedBurstPostId, setLikedBurstPostId] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
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
  const [showShareModal, setShowShareModal] = useState(false);
  const [postToShare, setPostToShare] = useState(null);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [postMenuAnchor, setPostMenuAnchor] = useState(null); // { post, top, left }
  const [reportTargetPost, setReportTargetPost] = useState(null);
  const [reportSubmitted, setReportSubmitted] = useState(false);

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

  // Fetch friends data
  const { data: friendsData } = useQuery({
    queryKey: ["friends"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/users/friends");
      return res.data?.data?.friends || [];
    },
    enabled: !!authUser,
  });

  // Fetch unread notification count (all types) — shared key with AppShell.jsx's identical query
  const { data: activityNotifications = 0 } = useQuery({
    queryKey: ["activityNotifications"],
    queryFn: async () => {
      if (!authUser) return 0;
      const res = await axiosInstance.get("/notifications?unreadOnly=true");
      return res.data?.data?.unreadCount || 0;
    },
    enabled: !!authUser,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Fetch message requests count — shared key with AppShell.jsx's identical query
  const { data: messageRequests = 0 } = useQuery({
    queryKey: ["messageRequests"],
    queryFn: async () => {
      if (!authUser) return 0;
      const res = await axiosInstance.get("/notifications?type=message_request&unreadOnly=true");
      return res.data?.data?.unreadCount || 0;
    },
    enabled: !!authUser,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Fetch incoming connection requests — shared key with AppShell.jsx's identical query
  const { data: incomingRequests = [] } = useQuery({
    queryKey: ["incomingRequests"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/users/friend-requests");
      return res.data?.data?.incomingRequests || [];
    },
    enabled: !!authUser,
    staleTime: 10000,
    refetchInterval: 15000,
  });

  // Total unread count for badges (includes all notification types + friend requests)
  const totalUnreadCount = activityNotifications + messageRequests + incomingRequests.length;

  // Fetch personalized recommendations for the sidebar
  const { data: personalizedRecommendations = [] } = useQuery({
    queryKey: ["personalizedRecommendations"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/personalization/recommendations?limit=3");
      return res.data?.data?.recommendations || [];
    },
    enabled: !!authUser,
  });

  // Fetch trending locations for the sidebar
  const { data: trendingLocations = [] } = useQuery({
    queryKey: ["trendingLocations"],
    queryFn: async () => {
      if (!authUser) return [];
      const res = await axiosInstance.get("/personalization/trending-locations?limit=5");
      return res.data?.data?.trendingLocations || [];
    },
    enabled: !!authUser,
  });

  // Mark notifications as read when visiting chat, activity, or connections section
  useEffect(() => {
    if ((activeSection === "chat" || activeSection === "activity" || activeSection === "connections") && totalUnreadCount > 0) {
      const markNotificationsAsRead = async () => {
        try {
          await axiosInstance.patch("/notifications/read-all");
          queryClient.invalidateQueries({ queryKey: ["activityNotifications"] });
          queryClient.invalidateQueries({ queryKey: ["messageRequests"] });
          queryClient.invalidateQueries({ queryKey: ["incomingRequests"] });
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
      setActiveSection("chat");
      // You might want to select the specific user in chat here
      toast.success("Opening chat with " + post.author?.fullName?.split(" ")[0]);
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
      queryClient.invalidateQueries({ queryKey: ["activityNotifications"] });
      queryClient.invalidateQueries({ queryKey: ["messageRequests"] });

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
  });

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [, setLoadingSuggestions] = useState(false);
  const mapRef = useRef(null);
  const geocodeTimeoutRef = useRef(null);

  // Fix Leaflet default marker icon issue
  useEffect(() => {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    });
  }, []);

  // Custom marker component with drag and click
  function DraggableMarker({ position, onPositionChange }) {
    const [markerPosition, setMarkerPosition] = useState(position);
    const markerRef = useRef(null);

    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setMarkerPosition([lat, lng]);
        onPositionChange(lat, lng);
      },
    });

    useEffect(() => {
      if (markerRef.current && position[0] !== markerPosition[0] || position[1] !== markerPosition[1]) {
        setMarkerPosition(position);
      }
    }, [position]);

    return (
      <Marker
        position={markerPosition}
        draggable={true}
        ref={markerRef}
        eventHandlers={{
          dragend(e) {
            const marker = e.target;
            const position = marker.getLatLng();
            setMarkerPosition([position.lat, position.lng]);
            onPositionChange(position.lat, position.lng);
          },
        }}
      />
    );
  }

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

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      
      // Handle author-specific search
      if (searchType === 'author' && searchAuthorId) {
        params.set("authorId", searchAuthorId);
      } else if (search.trim()) {
        params.set("q", search.trim());
      }
      
      if (queryListingType) params.set("listingType", queryListingType);
      if (queryPropertyType) params.set("propertyType", queryPropertyType);
      
      // Add category filter
      if (activeCategory && activeCategory !== "For You") {
        params.set("category", activeCategory.toLowerCase());
      }

      const response = await axiosInstance.get(`/posts?${params.toString()}`);
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      return current < total ? current + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: Boolean(authUser?._id),
  });

  // Infinite scroll implementation
  const observerRef = useRef(null);
  const loadMoreRef = useCallback((node) => {
    if (isFetchingNextPage) return;
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    }, { threshold: 0.1, rootMargin: '100px' });

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
        const nearMeOk = activeCategory === "Near Me"
          ? authUser?.city
            ? String(post.city || "").toLowerCase().includes(String(authUser.city).toLowerCase())
            : true
          : true;

        return cityOk && localityOk && minOk && maxOk && verifiedOk && luxuryOk && investmentOk && nearMeOk;
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
    enabled: Boolean(authUser?._id) && !search.trim(),
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

  const hasNewPosts = Boolean(
    latestFeedPost?.latestCreatedAt &&
    feedLoadedAt &&
    new Date(latestFeedPost.latestCreatedAt).getTime() > feedLoadedAt.getTime()
  );

  const handleShowNewPosts = () => {
    queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    const requirement = post.postMeta?.requirement || {};
    const project = post.postMeta?.project || {};
    const investment = post.postMeta?.investment || {};
    const land = post.postMeta?.land || {};
    const commercial = post.postMeta?.commercial || {};
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
      floorNumber: commercial.floorNumber || "",
      washrooms: commercial.washrooms || "",
      status: "DRAFT",
    };
  };

  const resumeDraft = (post) => {
    setDraft(mapPostToDraftState(post));
    setEditingDraftId(post._id);
    setShowDraftsList(false);
    setComposerResult(null);
    setComposerStep(1);
  };

  // Same underlying flow as resuming a draft — the composer always PUTs to
  // the existing post when editingDraftId is set, and submitting normally
  // (not "Save as Draft") re-sends status: "PUBLISHED", so this can't
  // accidentally unpublish a live listing.
  const handleEditPost = (post) => {
    resumeDraft(post);
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

  // The wizard's steps, collapsed from the old 6. Requirement posts (which
  // don't need photos) get a 3-step flow; everything else is 4.
  const composerSteps = useMemo(() => {
    const base = ["type", "details", "photos", "review"];
    return getPostTypeConfig(draft.postType).requiresMedia
      ? base
      : base.filter((key) => key !== "photos");
  }, [draft.postType]);
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

    const postMeta = {
      requirement: {
        furnishedPreference: draft.furnishedPreference || "",
        parkingRequired: Boolean(draft.parkingRequired),
        amenitiesText: draft.amenitiesText || "",
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
    };

    return {
      ...draft,
      status,
      price: isRequirement ? Number(draft.budgetMax || draft.price || 0) : Number(draft.price || 0),
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
        queryClient.setQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"], (oldData) => {
          if (!oldData) return oldData;

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
                posts: [newPost, ...oldData.pages[0].posts],
              },
              ...oldData.pages.slice(1),
            ],
         };
        });

        // Also invalidate to ensure data consistency
        queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
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

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyFeed"] });
      const previousFeed = queryClient.getQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"]);
      
      queryClient.setQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) => {
              if (post._id === postId) {
                const newLikedState = !post.isLikedByMe;
                return {
                  ...post,
                  isLikedByMe: newLikedState,
                  likesCount: newLikedState ? (post.likesCount || 0) + 1 : Math.max(0, (post.likesCount || 0) - 1),
                };
              }
              return post;
            }),
          })),
        };
      });
      
      return { previousFeed };
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"], context.previousFeed);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
    },
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: ["propertyFeed"] });
      const previousFeed = queryClient.getQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"]);
      
      queryClient.setQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"], (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            posts: page.posts.map((post) => {
              if (post._id === postId) {
                const newSavedState = !post.isSavedByMe;
                return {
                  ...post,
                  isSavedByMe: newSavedState,
                  savesCount: newSavedState ? (post.savesCount || 0) + 1 : Math.max(0, (post.savesCount || 0) - 1),
                };
              }
              return post;
            }),
          })),
        };
      });
      
      return { previousFeed };
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(["propertyFeed", activeCategory, search, searchType, searchAuthorId, queryListingType || "all", queryPropertyType || "all"], context.previousFeed);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["propertyFeed"] });
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
    enabled: !!authUser,
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

  const trendingLocalities = ["Indore - Super Corridor", "Bengaluru - Whitefield", "Pune - Hinjewadi", "Noida - Sector 150"];
  const savedSearches = ["2 BHK in Vijay Nagar", "Luxury Villa in Goa", "Commercial office in Noida"];

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
    }));
  };

  return (
    <AppShell
      hideHero
      lockPageScroll={activeSection === "chat" || (activeSection === "communities" && Boolean(selectedCommunity))}
      hideMobileHeader={activeSection === "chat" || (activeSection === "communities" && Boolean(selectedCommunity))}
      autoHideHeaderOnScroll={activeSection === "marketplace"}
      title="Marketplace"
      subtitle="Social-first discovery"
      marketplaceSearch={search}
      onMarketplaceSearchChange={(value, type, authorId) => {
        setSearch(value);
        setSearchType(type || null);
        setSearchAuthorId(authorId || null);
      }}
      onCreateProperty={() => setIsComposerOpen(true)}
    >
      <div className="xl:h-full xl:min-h-0">
        <div className="flex gap-4 xl:h-full">
          <aside className="hidden w-[220px] rounded-2xl border border-base-200 bg-base-200/90 p-3 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-base-content/60">Navigation</p>
            <div className="mt-2 space-y-1">
              {(authUser?.isAdmin ? [...LEFT_NAV_ITEMS, ADMIN_NAV_ITEM] : LEFT_NAV_ITEMS).map(({ label, icon, section }) => {
                // Renamed-destructure (`icon: NavIcon`) used only in JSX trips
                // up this project's no-unused-vars config as a false positive.
                const NavIcon = icon;
                // Calculate notification counts for badges
                let badgeCount = 0;
                if (section === "activity") {
                  badgeCount = totalUnreadCount; // Total unread notifications
                } else if (section === "connections") {
                  badgeCount = incomingRequests.length; // Connection requests
                } else if (section === "chat") {
                  badgeCount = messageRequests; // Message requests
                }

                return (
                  <button
                    key={label}
                    type="button"
                    className={`btn btn-sm w-full justify-start rounded-lg border-none relative ${
                      activeSection === section
                        ? "bg-primary/15 text-primary hover:bg-primary/15"
                        : "bg-transparent text-base-content/70 hover:bg-base-200 hover:text-base-content"
                    }`}
                    onClick={() => {
                      if (section === "map") {
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

            <div className="mt-4 flex items-center justify-between gap-3 border-b border-base-300 pb-3">
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

            <RoleBasedFilters
              userRole={activeRole}
              isOpen={isFiltersOpen}
              onClose={() => setIsFiltersOpen(false)}
              onApply={(filters) => setAppliedFilters(filters)}
              onReset={() => setAppliedFilters(filters)}
            />

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

            {isLoading ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-[420px] animate-pulse rounded-2xl bg-base-200" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-base-300 bg-base-100 p-8 text-center text-sm text-base-content/60">No listings found with current preferences.</div>
            ) : (
              <div className="mt-4 grid gap-5 2xl:grid-cols-2">
                {posts.map((post) => {
                  const imageIndex = Number(carouselIndex[post._id] || 0);
                  const badge = getListingBadge(post);
                  const postType = String(post.postType || "").toUpperCase();
                  const isRequirement = postType.startsWith("REQUIREMENT_");
                  const requirementTitle = post.title || (postType === "REQUIREMENT_RENT" ? "Looking for Rental Property" : "Looking to Buy Property");

                  const handlePrevImage = (e) => {
                    e.stopPropagation();
                    setCarouselIndex(prev => ({
                      ...prev,
                      [post._id]: (prev[post._id] || 0) > 0 ? (prev[post._id] || 0) - 1 : post.media.length - 1
                    }));
                  };
                  
                  const handleNextImage = (e) => {
                    e.stopPropagation();
                    setCarouselIndex(prev => ({
                      ...prev,
                      [post._id]: (prev[post._id] || 0) < post.media.length - 1 ? (prev[post._id] || 0) + 1 : 0
                    }));
                  };

                  const detailBadges = buildPropertyDetailBadges(post, activeRole);

                  const handleDoubleClickMedia = (event) => {
                    event.stopPropagation();
                    toggleLike(post._id);
                    setLikedBurstPostId(post._id);
                    setTimeout(() => {
                      setLikedBurstPostId((current) => (current === post._id ? null : current));
                    }, 700);
                  };

                  return (
                    <PropertyPostCard
                      key={post._id}
                      post={post}
                      media={post.media}
                      imageIndex={imageIndex}
                      onPrevImage={handlePrevImage}
                      onNextImage={handleNextImage}
                      onDoubleClickMedia={handleDoubleClickMedia}
                      badge={badge}
                      badgeClassName={
                        post.offerStatus === "ACCEPTED"
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
                        post.media.length === 0 && isRequirement ? (
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
                        likedBurstPostId === post._id ? (
                          <Heart className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-white/95 text-white drop-shadow-md animate-pulse" />
                        ) : null
                      }
                      priceBlock={
                        <>
                          <p className="inline-flex items-center gap-0.5 text-2xl font-black text-base-content">
                            <IndianRupee className="size-4 text-base-content" />
                            {formatMoney(post.price).replace("₹", "")}
                            {activeRole === "Tenant" && <span className="text-sm font-normal text-base-content/60">/mo</span>}
                          </p>
                          <p className="line-clamp-1 text-base font-semibold text-base-content">{isRequirement ? requirementTitle : post.title || "Premium Listing"}</p>
                          <div className="flex items-center gap-2 text-xs text-base-content/60">
                            <MapPin className="size-3" />
                            <span>{post.city || "City"}</span>
                            {post.locality && <><span>·</span><span>{post.locality}</span></>}
                            {post.latitude && post.longitude && (
                              <button
                                type="button"
                                className="flex items-center gap-1 text-primary hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/map-view?propertyId=${post._id}`);
                                }}
                              >
                                <span className="size-1.5 rounded-full bg-primary"></span>
                                <span>Live Location</span>
                              </button>
                            )}
                          </div>
                          {detailBadges.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {detailBadges.slice(0, 6).map((detail, idx) => (
                                <span
                                  key={idx}
                                  className={`rounded-full ${detail.color} px-2.5 py-1 text-xs font-medium ${detail.textColor}`}
                                >
                                  {detail.label}
                                </span>
                              ))}
                            </div>
                          )}
                          {post.postMeta?.moveInDate && activeRole === "Tenant" && (
                            <p className="text-xs text-base-content/70">Move-in: {new Date(post.postMeta.moveInDate).toLocaleDateString()}</p>
                          )}
                        </>
                      }
                      description={
                        <ClampedCaption text={post.caption || "A beautifully curated property with modern design and premium amenities."} />
                      }
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
                      className={selectedForComparison.includes(post._id) ? 'border-primary ring-2 ring-primary/20' : 'border-base-200'}
                    />
                  );
                })}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center">
                  <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  <span className="ml-2 text-sm text-base-content/60">Loading more posts...</span>
                </div>
              )}
            </div>
              </>
            ) : activeSection === "activity" ? (
              <ActivityContent onNavigateToPost={(postId) => {
                navigate(`/property/${postId}`);
              }} />
            ) : activeSection === "communities" ? (
              selectedCommunity ? (
                <CommunityChat
                  community={selectedCommunity}
                  onBack={() => setSelectedCommunity(null)}
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
          </main>

          {activeSection === "marketplace" ? (
            <aside className="hidden w-[320px] rounded-2xl border border-base-200 bg-base-200/90 p-4 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-base-content">Trending Localities</p>
                <button
                  type="button"
                  className="btn btn-xs border border-base-300 bg-base-100 text-primary hover:bg-primary/10"
                  onClick={() => navigate("/trending-localities")}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {trendingLocalities.map((item) => (
                  <div key={item} className="rounded-xl border border-base-300 p-2 text-xs font-medium text-base-content">{item}</div>
                ))}
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
              <div className="mb-2">
                <p className="text-sm font-bold text-base-content">Recommended for You</p>
              </div>
              <div className="space-y-2">
                {personalizedRecommendations.length > 0 ? (
                  personalizedRecommendations.slice(0, 3).map((post) => (
                    <button
                      key={`rec-${post._id}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border border-base-300 p-2 text-left hover:bg-base-200"
                      onClick={() => navigate(`/property/${post._id}`)}
                    >
                      <img src={post.mediaUrls?.[0] || post.media?.[0]} alt={post.title || "Recommendation"} className="h-12 w-16 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-base-content">{post.title || "Property"}</p>
                        <p className="truncate text-[11px] text-base-content/60">{formatMoney(post.price)} · {post.city || "India"}</p>
                      </div>
                    </button>
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
              <div className="mb-2">
                <p className="text-sm font-bold text-base-content">Saved Searches</p>
              </div>
              <div className="space-y-2">
                {savedSearches.map((item) => (
                  <div key={item} className="rounded-lg border border-base-300 p-2 text-xs text-base-content">{item}</div>
                ))}
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
        <button type="button" className="btn btn-circle fixed bottom-24 right-5 z-40 h-14 w-14 border-none bg-primary text-white shadow-xl hover:bg-primary xl:hidden" onClick={() => setIsComposerOpen(true)}>
          <Plus className="size-6" />
        </button>
      )}

      <CompareFloatingBar selected={selectedForComparison} />

      <FullscreenMediaViewer src={selectedImage} onClose={() => setSelectedImage(null)} />

      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35" onClick={resetComposer}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-5xl overflow-y-auto border-l border-base-300 bg-base-100" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-base-300 bg-base-100 px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="size-4" />
                    Create Post
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-base-content">
                    {showDraftsList
                      ? "Your Drafts"
                      : composerResult
                        ? (composerResult === "DRAFT" ? "Saved as draft" : "Post published")
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
                      : "Your post is now live and discoverable."}
                  </p>
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
                        <MapContainer
                          key={draft.latitude && draft.longitude ? `${draft.latitude}-${draft.longitude}` : "default"}
                          center={draft.latitude && draft.longitude ? [draft.latitude, draft.longitude] : DEFAULT_MAP_CENTER}
                          zoom={draft.latitude && draft.longitude ? 13 : 5}
                          style={{ height: '100%', width: '100%' }}
                          ref={mapRef}
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <DraggableMarker
                            position={draft.latitude && draft.longitude ? [draft.latitude, draft.longitude] : DEFAULT_MAP_CENTER}
                            onPositionChange={handleMapPositionChange}
                          />
                        </MapContainer>
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
                    </div>
                  </div>
                </div>
              ) : null}

              {stepKey === "review" && !composerResult ? (
                <div>
                  <p className="text-sm font-semibold text-base-content/70">Review &amp; publish</p>
                  <article className="mt-4 overflow-hidden rounded-2xl border border-base-300">
                    {composerMedia.length > 0 && isVideoUrl(composerMedia[0]) ? (
                      <video src={composerMedia[0]} alt="Preview" className="h-64 w-full object-cover" controls />
                    ) : (
                      <img src={composerMedia[0] || "https://placehold.co/1400x900?text=Preview"} alt="Preview" className="h-64 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <p className="text-xs text-base-content/60">{getListingBadge(draft)} · {draft.propertyType || draft.requirementPropertyType || "Real Estate"}</p>
                      <p className="mt-1 text-xl font-bold text-base-content">{draft.title || "Untitled post"}</p>
                      <p className="mt-1 text-sm text-base-content/70">{draft.caption || "No description added."}</p>
                      <p className="mt-2 text-xs text-base-content/60">
                        {[draft.city, draft.locality].filter(Boolean).join(", ") || "No location set"}
                      </p>
                    </div>
                  </article>
                  <p className="mt-3 text-xs text-base-content/60">
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
                      <button
                        type="button"
                        className="btn border-none bg-primary text-white hover:bg-primary"
                        disabled={!stepValid}
                        onClick={() => setComposerStep((prev) => Math.min(totalComposerSteps, prev + 1))}
                      >
                        Next
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      {draftToDelete ? (
        <ConfirmDeleteModal
          title="Delete this draft?"
          description={`"${draftToDelete.title || "Untitled draft"}" will be permanently deleted. This can't be undone.`}
          isPending={deletingDraft}
          onConfirm={() => deleteDraft(draftToDelete._id)}
          onClose={() => setDraftToDelete(null)}
        />
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

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => {
          setShowShareModal(false);
          setPostToShare(null);
        }}
        postUrl={postToShare ? `${window.location.origin}/property/${postToShare._id}` : ""}
        postTitle={postToShare?.title || "Property"}
        postId={postToShare?._id}
        postImage={postToShare ? normalizeMedia(postToShare)[0] : ""}
      />

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

      {postMenuAnchor &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setPostMenuAnchor(null)} />
            <div
              className="fixed z-50 w-36 rounded-xl border border-base-300 bg-base-100 py-1 shadow-lg"
              style={{ top: postMenuAnchor.top, left: postMenuAnchor.left }}
            >
              {String(authUser?._id) === String(postMenuAnchor.post.author?._id) ? (
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
