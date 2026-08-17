import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  Eye,
  Filter,
  Heart,
  Home,
  IndianRupee,
  Map,
  MapPin,
  Maximize,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Send,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Upload,
  UserCircle,
  UserRoundPlus,
  Users,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import ShareModal from "../components/ShareModal";
import toast from "react-hot-toast";
import AppShell from "../components/AppShell";
import PostAuthorLink from "../components/PostAuthorLink";
import CommentSection from "../components/CommentSection";
import ChatContent from "../components/ChatContent";
import ConnectionsContent from "../components/ConnectionsContent";
import CallContent from "../components/CallContent";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import ProfileContent from "../components/ProfileContent";
import ActivityContent from "../components/ActivityContent";
import CommunitiesContent from "../components/CommunitiesContent";
import CommunityChat from "../components/CommunityChat";
import RoleBasedPropertyCard from "../components/RoleBasedPropertyCard";
import RoleBasedFilters from "../components/RoleBasedFilters";
import StoriesBar from "../components/StoriesBar";
import RoleBasedDashboard from "../components/RoleBasedDashboard";
import axiosInstance from "../lib/axios";

const DEFAULT_MAP_CENTER = [20.5937, 78.9629]; // geographic center of India, used until a location is picked

const LEFT_NAV_ITEMS = [
  { label: "Marketplace", icon: Home, section: "marketplace" },
  { label: "Activity", icon: Bell, section: "activity" },
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

const CATEGORY_CHIPS = [
  "For You",
  "Following",
  "Near Me",
  "Luxury",
  "Commercial",
  "Agricultural",
  "Investment",
  "Verified",
  "Recent",
];

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
const FURNISHING_OPTIONS = ["Furnished", "Semi-Furnished", "Unfurnished"];
const OCCUPANCY_OPTIONS = ["Single", "Double", "Shared", "Any"];
const GENDER_OPTIONS = ["Any", "Male", "Female"];
const TENANT_OPTIONS = ["Family", "Bachelors", "Students", "Any"];

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
    : ["https://placehold.co/1400x900?text=INSELL+Listing"];
}

function isVideoUrl(url) {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  return videoExtensions.some((ext) => String(url).toLowerCase().endsWith(ext));
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

function getListingBadge(post) {
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

function getPostPrimaryCta(post, friends, authUser) {
  // Check if already friends
  const isFriend = friends?.some(friend => friend._id === post.author?._id);
  const isOwnPost = authUser?._id === post.author?._id;
  
  // Show "Message" if already friends
  if (isFriend && !isOwnPost) {
    return "💬 Message";
  }
  
  // Show "Edit" if own post
  if (isOwnPost) {
    return "✏️ Edit";
  }
  
  const postType = String(post.postType || "").toUpperCase();
  const listingType = String(post.listingType || "").toUpperCase();
  
  // Dynamic contact buttons based on property type
  if (postType === "PROPERTY_RENT" || postType === "REQUIREMENT_RENT") {
    return "🏠 I'm Interested";
  }
  if (postType === "PROPERTY_SALE" || postType === "REQUIREMENT_BUY") {
    return "💰 Make an Offer";
  }
  if (postType === "BUILDER_PROJECT") {
    return "📅 Book Site Visit";
  }
  if (postType === "INVESTMENT_OPPORTUNITY") {
    return "📊 View Details";
  }
  if (postType === "COMMERCIAL_LISTING") {
    return "📅 Schedule Visit";
  }
  if (postType === "AGRICULTURAL_LISTING") {
    return "🌾 Request Details";
  }
  if (postType === "OPEN_HOUSE_EVENT") {
    return "🎟️ Register";
  }
  
  // Fallback based on listing type
  if (listingType === "RENT") return "🏠 I'm Interested";
  if (listingType === "SALE") return "💰 Make an Offer";
  
  return "📩 Contact Owner";
}

function getRoleHighlights(post, role) {
  const highlights = [];
  const postType = String(post.postType || "").toUpperCase();

  switch (role) {
    case "Tenant":
      if (post.postMeta?.furnishing) highlights.push(post.postMeta.furnishing);
      if (post.postMeta?.occupancy) highlights.push(post.postMeta.occupancy);
      if (post.postMeta?.moveInDate) highlights.push(`Move-in: ${new Date(post.postMeta.moveInDate).toLocaleDateString()}`);
      break;
    case "Buyer":
      if (post.postMeta?.reraVerified) highlights.push("RERA Verified");
      if (post.postMeta?.possessionStatus) highlights.push(post.postMeta.possessionStatus);
      if (post.postMeta?.ageOfProperty) highlights.push(post.postMeta.ageOfProperty);
      break;
    case "Seller":
      if (post.viewCount) highlights.push(`${post.viewCount} views`);
      if (post.engagementScore) highlights.push(`Score: ${post.engagementScore}`);
      if (post.postMeta?.daysListed) highlights.push(`${post.postMeta.daysListed} days listed`);
      break;
    case "Broker":
      if (post.postMeta?.leadQuality) highlights.push(post.postMeta.leadQuality);
      if (post.postMeta?.commissionRate) highlights.push(`${post.postMeta.commissionRate}% commission`);
      if (post.postMeta?.isUrgent) highlights.push("Urgent");
      break;
    case "Builder":
      if (post.postMeta?.projectStatus) highlights.push(post.postMeta.projectStatus);
      if (post.postMeta?.reraNumber) highlights.push("RERA Registered");
      if (post.postMeta?.launchYear) highlights.push(`Launched ${post.postMeta.launchYear}`);
      break;
    case "Investor":
      if (post.postMeta?.roi) highlights.push(`${post.postMeta.roi}% ROI`);
      if (post.postMeta?.investmentType) highlights.push(post.postMeta.investmentType);
      if (post.postMeta?.timeHorizon) highlights.push(post.postMeta.timeHorizon);
      break;
    default:
      if (post.bedrooms) highlights.push(`${post.bedrooms} BHK`);
      if (post.areaSqft) highlights.push(`${Number(post.areaSqft)} sqft`);
  }

  return highlights;
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
  const recommendedPostTypes = ROLE_RECOMMENDED_OPTIONS[activeRole] || ["PROPERTY_SALE"];
  const availablePostTypes = ALL_CREATE_POST_TYPES;

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [searchType, setSearchType] = useState(null);
  const [searchAuthorId, setSearchAuthorId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("For You");
  const [selectedTrendingLocation, setSelectedTrendingLocation] = useState(null);
  const [activeStory, setActiveStory] = useState("Premium Projects");
  const [carouselIndex, setCarouselIndex] = useState({});
  const [expandedPostIds, setExpandedPostIds] = useState({});
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

  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isNavHovered, setIsNavHovered] = useState(false);
  const navExpanded = !isNavCollapsed || isNavHovered;

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    transactionType: "All",
    propertyType: "All",
    city: "",
    locality: "",
    budgetMin: 0,
    budgetMax: 150000000,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [composerStep, setComposerStep] = useState(1);
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
  });

  const [citySuggestions, setCitySuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
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

    const map = useMapEvents({
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

  const { mutate: createPost, isPending: creating } = useMutation({
    mutationFn: async () => {
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
      };

      const payload = {
        ...draft,
        price: isRequirement ? Number(draft.budgetMax || draft.price || 0) : Number(draft.price || 0),
        mediaUrls,
        postType: draft.postType,
        postMeta,
        latitude: draft.latitude,
        longitude: draft.longitude,
      };
      const response = await axiosInstance.post("/posts", payload);
      return response.data?.data?.post;
    },
    onSuccess: (data) => {
      // Add the new post to the beginning of the feed cache for immediate visibility
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
      setComposerStep(6);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.message || "Failed to create post");
    },
  });

  const { mutate: uploadMedia, isPending: uploading } = useMutation({
    mutationFn: async (files) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("media", file));
      const response = await axiosInstance.post("/posts/upload-media", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      return response.data?.data;
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
      toast.error(error?.response?.data?.message || "Failed to upload media");
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

  // Fetch trending news from backend
  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ["trendingNews"],
    queryFn: async () => {
      const response = await axiosInstance.get("/news/trending");
      console.log("Marketplace news response:", response.data);
      return response.data.data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

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
    if (composerStep === 1) return Boolean(draft.postType);
    if (composerStep === 2) {
      const requiresMedia = !String(draft.postType || "").startsWith("REQUIREMENT_");
      return requiresMedia ? Boolean(composerMedia.length) : true;
    }
    if (composerStep === 3) return Boolean(String(draft.title || "").trim());
    return true;
  }, [composerMedia.length, composerStep, draft.listingType, draft.postType, draft.title]);

  const resetComposer = () => {
    setIsComposerOpen(false);
    setComposerStep(1);
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
    }));
  };

  return (
    <AppShell
      hideHero
      lockPageScroll
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
          <aside
            className={`hidden rounded-2xl border border-slate-100 bg-slate-50/90 p-3 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto ${navExpanded ? "w-[220px]" : "w-[78px]"}`}
            onMouseEnter={() => setIsNavHovered(true)}
            onMouseLeave={() => setIsNavHovered(false)}
          >
            <button
              type="button"
              className="btn btn-sm mb-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              onClick={() => setIsNavCollapsed((prev) => !prev)}
            >
              {navExpanded ? "Compact" : "Expand"}
            </button>

            <p className={`text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${navExpanded ? "" : "hidden"}`}>Navigation</p>
            <div className="mt-2 space-y-1">
              {(authUser?.isAdmin ? [...LEFT_NAV_ITEMS, ADMIN_NAV_ITEM] : LEFT_NAV_ITEMS).map(({ label, icon: Icon, section }) => {
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
                    className={`btn btn-sm w-full rounded-lg border-none relative ${
                      activeSection === section
                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100"
                        : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                    } ${navExpanded ? "justify-start" : "justify-center"}`}
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
                      <Icon className="size-4" />
                      {badgeCount > 0 && (
                        <span className="absolute -right-2 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                          {badgeCount > 9 ? "9+" : badgeCount}
                        </span>
                      )}
                    </div>
                    {navExpanded ? <span>{label}</span> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-auto rounded-xl border border-slate-200 bg-indigo-50 p-3 text-xs text-slate-600">
              <p className={`font-semibold text-indigo-700 ${navExpanded ? "" : "text-center"}`}>Go Premium</p>
              {navExpanded ? <p className="mt-1">Get more visibility and reach serious buyers faster.</p> : null}
              <button type="button" className="btn btn-sm mt-3 w-full border-none bg-indigo-600 text-white hover:bg-indigo-500">Upgrade</button>
            </div>
          </aside>

          <main
            className={`min-w-0 flex-1 rounded-2xl bg-transparent p-1 pb-6 xl:h-[calc(100dvh-7.1rem)] xl:overflow-y-auto ${
              activeSection === "chat" || (activeSection === "communities" && selectedCommunity)
                ? "h-[calc(100dvh-9rem)] overflow-hidden"
                : activeSection === "communities"
                  ? "xl:h-[calc(100dvh-9rem)] xl:overflow-hidden"
                  : ""
            }`}
          >
            {activeSection === "marketplace" ? (
              <>
                <StoriesBar onCategorySelect={setActiveCategory} />

            <div className="mt-4 flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                {CATEGORY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`btn btn-sm rounded-full border-none ${activeCategory === chip ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
                    onClick={() => setActiveCategory(chip)}
                  >
                    {chip}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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

            {isLoading ? (
              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No listings found with current preferences.</div>
            ) : (
              <div className="mt-4 grid gap-5 2xl:grid-cols-2">
                {posts.map((post) => {
                  const imageIndex = Number(carouselIndex[post._id] || 0);
                  const image = post.media[imageIndex] || post.media[0];
                  const verified = post.author?.isVerified || false;
                  const readMore = expandedPostIds[post._id];
                  const badge = getListingBadge(post);
                  const postType = String(post.postType || "").toUpperCase();
                  const isRequirement = postType.startsWith("REQUIREMENT_");
                  const requirementTitle = post.title || (postType === "REQUIREMENT_RENT" ? "Looking for Rental Property" : "Looking to Buy Property");
                  const hasMultipleImages = post.media.length > 1;

                  // Role-based highlights
                  const roleHighlights = getRoleHighlights(post, activeRole);

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

                  return (
                    <article
                      key={post._id}
                      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
                        selectedForComparison.includes(post._id)
                          ? 'border-indigo-500 ring-2 ring-indigo-200'
                          : 'border-slate-100'
                      }`}
                      onClick={() => navigate(`/property/${post._id}`)}
                    >
                      <div className="relative overflow-hidden">
                        {post.media.length > 0 ? (
                          isVideoUrl(image) ? (
                            <video
                              src={image}
                              alt={post.title || "Property"}
                              className="h-[22rem] w-full object-cover"
                              controls
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                toggleLike(post._id);
                                setLikedBurstPostId(post._id);
                                setTimeout(() => {
                                  setLikedBurstPostId((current) => (current === post._id ? null : current));
                                }, 700);
                              }}
                            />
                          ) : (
                            <>
                              <img
                                src={image}
                                alt={post.title || "Property"}
                                className="h-[22rem] w-full object-cover"
                                loading="lazy"
                                onDoubleClick={(event) => {
                                  event.stopPropagation();
                                  toggleLike(post._id);
                                  setLikedBurstPostId(post._id);
                                  setTimeout(() => {
                                    setLikedBurstPostId((current) => (current === post._id ? null : current));
                                  }, 700);
                                }}
                              />
                              
                              {/* Image navigation arrows */}
                              {hasMultipleImages && (
                                <>
                                  <button
                                    type="button"
                                    onClick={handlePrevImage}
                                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                  >
                                    <ChevronLeft className="size-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleNextImage}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white transition-opacity hover:bg-black/70"
                                  >
                                    <ChevronRight className="size-4" />
                                  </button>
                                  {/* Image indicator */}
                                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                                    {post.media.map((_, idx) => (
                                      <div
                                        key={idx}
                                        className={`h-1.5 w-1.5 rounded-full transition-colors ${
                                          idx === imageIndex ? 'bg-white' : 'bg-white/50'
                                        }`}
                                      />
                                    ))}
                                  </div>
                                </>
                              )}
                            </>
                          )
                        ) : isRequirement ? (
                          <div className="flex h-[18rem] items-end bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 p-4 text-white">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-white/80">Requirement Post</p>
                              <p className="mt-1 text-2xl font-black leading-tight">{requirementTitle}</p>
                              <p className="mt-2 text-sm text-white/90">
                                {post.bedrooms || 0} BHK · Budget {formatMoney(post.price)} · {post.city || "Any city"}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={image}
                            alt={post.title || "Property"}
                            className="h-[22rem] w-full object-cover"
                            loading="lazy"
                            onDoubleClick={(event) => {
                              event.stopPropagation();
                              toggleLike(post._id);
                              setLikedBurstPostId(post._id);
                              setTimeout(() => {
                                setLikedBurstPostId((current) => (current === post._id ? null : current));
                              }, 700);
                            }}
                          />
                        )}

                        <div className="absolute left-3 top-3">
                          <PostAuthorLink
                            author={post.author}
                            sizeClass="size-6"
                            textColor="white"
                            meta={<p className="truncate text-[10px] text-white/90">{relativeDate(post.createdAt)}</p>}
                          />
                        </div>

                        <div className="absolute right-3 top-3 flex items-center gap-1">
                          <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700">{badge}</span>
                        </div>

                        <div className="absolute right-3 bottom-3 flex items-center gap-2">
                          <button
                            type="button"
                            className={`size-8 rounded-full backdrop-blur-sm flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 ${
                              selectedForComparison.includes(post._id)
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                                : 'bg-white/90 text-slate-600 hover:bg-white hover:text-indigo-600'
                            }`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedForComparison(prev => {
                                const isSelected = prev.includes(post._id);
                                if (isSelected) {
                                  return prev.filter(id => id !== post._id);
                                } else if (prev.length < 4) {
                                  return [...prev, post._id];
                                } else {
                                  toast.error("Maximum 4 properties can be compared");
                                  return prev;
                                }
                              });
                            }}
                            title={selectedForComparison.includes(post._id) ? "Remove from comparison" : "Add to comparison"}
                          >
                            {selectedForComparison.includes(post._id) ? (
                              <div className="relative">
                                <Check className="size-5" strokeWidth={3} />
                              </div>
                            ) : (
                              <Square className="size-4" strokeWidth={2} />
                            )}
                          </button>
                          <button
                            type="button"
                            className="size-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-slate-600 hover:bg-white transition-colors opacity-0 group-hover:opacity-100"
                            onClick={(event) => {
                              event.stopPropagation();
                              setPostToShare(post);
                              setShowShareModal(true);
                            }}
                          >
                            <Share2 className="size-4" />
                          </button>
                        </div>

                        {likedBurstPostId === post._id ? (
                          <Heart className="pointer-events-none absolute left-1/2 top-1/2 size-16 -translate-x-1/2 -translate-y-1/2 fill-white/95 text-white drop-shadow-md animate-pulse" />
                        ) : null}

                        {/* {post.media.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-xs btn-circle absolute left-2 top-1/2 -translate-y-1/2 z-50 border border-slate-200 bg-white/90 text-slate-600 pointer-events-auto"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.nativeEvent.stopImmediatePropagation();
                                setCarouselIndex((prev) => ({
                                  ...prev,
                                  [post._id]: imageIndex === 0 ? post.media.length - 1 : imageIndex - 1,
                                }));
                              }}
                            >
                              <ChevronLeft className="size-3" />
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2 z-50 border border-slate-200 bg-white/90 text-slate-600 pointer-events-auto"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                event.nativeEvent.stopImmediatePropagation();
                                setCarouselIndex((prev) => ({
                                  ...prev,
                                  [post._id]: imageIndex === post.media.length - 1 ? 0 : imageIndex + 1,
                                }));
                              }}
                            >
                              <ChevronRight className="size-3" />
                            </button>
                            <span className="absolute bottom-2 right-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-semibold text-white">
                              {imageIndex + 1}/{post.media.length}
                            </span>
                          </>
                        ) : null} */}

                        {post.media.length > 0 ? (
                          <button
                            type="button"
                            className="btn btn-xs absolute bottom-2 left-2 border-none bg-black/55 text-white hover:bg-black/65"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedImage(image);
                            }}
                          >
                            Full screen
                          </button>
                        ) : null}
                      </div>

                      <div className="space-y-2 p-3">
                        {/* Role-based content display */}
                        {(() => {
                          // Collect all available details
                          const details = [];
                          
                          // Basic details always shown
                          if (post.bedrooms) details.push({ label: `${post.bedrooms} BHK`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.bathrooms) details.push({ label: `${post.bathrooms} Baths`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.areaSqft) details.push({ label: `${Number(post.areaSqft)} sqft`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.propertyType) details.push({ label: post.propertyType, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          
                          // Role-specific details
                          if (activeRole === "Tenant") {
                            if (post.postMeta?.furnishing) details.push({ label: post.postMeta.furnishing, color: 'bg-indigo-50', textColor: 'text-indigo-700' });
                            if (post.postMeta?.occupancy) details.push({ label: post.postMeta.occupancy, color: 'bg-indigo-50', textColor: 'text-indigo-700' });
                            if (post.postMeta?.amenities?.length) details.push({ label: `${post.postMeta.amenities.length} Amenities`, color: 'bg-emerald-50', textColor: 'text-emerald-700' });
                          } else if (activeRole === "Buyer") {
                            if (post.postMeta?.possessionStatus) details.push({ label: post.postMeta.possessionStatus, color: 'bg-emerald-50', textColor: 'text-emerald-700' });
                            if (post.postMeta?.reraVerified) details.push({ label: 'RERA Verified', color: 'bg-blue-50', textColor: 'text-blue-700' });
                            if (post.postMeta?.ageOfProperty) details.push({ label: post.postMeta.ageOfProperty, color: 'bg-slate-100', textColor: 'text-slate-700' });
                            if (post.postMeta?.parking) details.push({ label: 'Parking', color: 'bg-slate-100', textColor: 'text-slate-700' });
                          } else if (activeRole === "Seller") {
                            if (post.engagementScore) details.push({ label: `Score: ${post.engagementScore}`, color: 'bg-indigo-50', textColor: 'text-indigo-700' });
                            if (post.postMeta?.daysListed) details.push({ label: `${post.postMeta.daysListed} days`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          } else if (activeRole === "Broker") {
                            if (post.postMeta?.leadQuality) details.push({ label: post.postMeta.leadQuality, color: 'bg-emerald-50', textColor: 'text-emerald-700' });
                            if (post.postMeta?.commissionRate) details.push({ label: `${post.postMeta.commissionRate}% Comm`, color: 'bg-amber-50', textColor: 'text-amber-700' });
                            if (post.postMeta?.isUrgent) details.push({ label: 'Urgent', color: 'bg-red-50', textColor: 'text-red-700' });
                          } else if (activeRole === "Builder") {
                            if (post.postMeta?.projectStatus) details.push({ label: post.postMeta.projectStatus, color: 'bg-blue-50', textColor: 'text-blue-700' });
                            if (post.postMeta?.reraNumber) details.push({ label: 'RERA Registered', color: 'bg-emerald-50', textColor: 'text-emerald-700' });
                            if (post.postMeta?.launchYear) details.push({ label: post.postMeta.launchYear, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          } else if (activeRole === "Investor") {
                            if (post.postMeta?.roi) details.push({ label: `${post.postMeta.roi}% ROI`, color: 'bg-emerald-50', textColor: 'text-emerald-700' });
                            if (post.postMeta?.investmentType) details.push({ label: post.postMeta.investmentType, color: 'bg-indigo-50', textColor: 'text-indigo-700' });
                            if (post.postMeta?.timeHorizon) details.push({ label: post.postMeta.timeHorizon, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          }
                          
                          // Additional postMeta fields if available
                          if (post.postMeta?.facing) details.push({ label: post.postMeta.facing, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.postMeta?.floorNumber) details.push({ label: `Floor ${post.postMeta.floorNumber}`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.postMeta?.totalFloors) details.push({ label: `${post.postMeta.totalFloors} Floors`, color: 'bg-slate-100', textColor: 'text-slate-700' });
                          if (post.postMeta?.maintenanceCharges) details.push({ label: `₹${post.postMeta.maintenanceCharges}/mo`, color: 'bg-slate-100', textColor: 'text-slate-700' });

                          return (
                            <>
                              <p className="inline-flex items-center gap-0.5 text-2xl font-black text-slate-800">
                                <IndianRupee className="size-4 text-slate-700" />
                                {formatMoney(post.price).replace("₹", "")}
                                {activeRole === "Tenant" && <span className="text-sm font-normal text-slate-500">/mo</span>}
                              </p>
                              <p className="line-clamp-1 text-base font-semibold text-slate-800">{isRequirement ? requirementTitle : post.title || "Premium Listing"}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <MapPin className="size-3" />
                                <span>{post.city || "City"}</span>
                                {post.locality && <><span>·</span><span>{post.locality}</span></>}
                                {post.latitude && post.longitude && (
                                  <span className="flex items-center gap-1 text-indigo-600">
                                    <span className="size-1.5 rounded-full bg-indigo-600"></span>
                                    <span>Live Location</span>
                                  </span>
                                )}
                              </div>
                              {details.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {details.slice(0, 6).map((detail, idx) => (
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
                                <p className="text-xs text-slate-600">Move-in: {new Date(post.postMeta.moveInDate).toLocaleDateString()}</p>
                              )}
                            </>
                          );
                        })()}

                        <div className="text-xs text-slate-600">
                          <p className={readMore ? "" : "line-clamp-2"}>{post.caption || "A beautifully curated property with modern design and premium amenities."}</p>
                          {(post.caption || "").length > 100 ? (
                            <button
                              type="button"
                              className="mt-1 font-semibold text-indigo-600"
                              onClick={(event) => {
                                event.stopPropagation();
                                setExpandedPostIds((prev) => ({ ...prev, [post._id]: !prev[post._id] }));
                              }}
                            >
                              {readMore ? "Read less" : "Read more"}
                            </button>
                          ) : null}
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleLike(post._id);
                                }}
                              >
                                <Heart className={`size-4 ${post.isLikedByMe ? "fill-red-500 text-red-500" : ""}`} />
                              </button>
                              <span className="text-[11px] text-slate-500">{post.likesCount}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Eye className="size-4 text-slate-400" />
                              <span className="text-[11px] text-slate-500">{post.viewCount || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100" onClick={(event) => { event.stopPropagation(); setSelectedPostForComments(post); }}><MessageCircle className="size-4" /></button>
                              <span className="text-[11px] text-slate-500">{post.commentCount || 0}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs btn-circle text-slate-500 hover:bg-slate-100"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleSave(post._id);
                                }}
                              >
                                <Bookmark className={`size-4 ${post.isSavedByMe ? "fill-indigo-600 text-indigo-600" : ""}`} />
                              </button>
                              <span className="text-[11px] text-slate-500">{post.savesCount || 0}</span>
                            </div>
                          </div>
                          <button 
                            type="button" 
                            className="btn btn-ghost btn-xs rounded-full text-slate-600 hover:bg-slate-100" 
                            onClick={(event) => {
                              event.stopPropagation();
                              handleContactClick(post);
                            }}
                          >
                            <Phone className="size-3.5" />
                            {(() => {
                              const authorName = post.author?.fullName || post.author?.name || "Owner";
                              const firstName = authorName.split(" ")[0];
                              return `Contact ${firstName}`;
                            })()}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Infinite scroll sentinel */}
            <div ref={loadMoreRef} className="py-4">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center">
                  <div className="size-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent"></div>
                  <span className="ml-2 text-sm text-slate-500">Loading more posts...</span>
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
            <aside className="hidden w-[320px] rounded-2xl border border-slate-100 bg-slate-50/90 p-4 pb-6 shadow-sm xl:sticky xl:top-1 xl:flex xl:h-[calc(100dvh-7.1rem)] xl:flex-col xl:overflow-y-auto">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Trending Localities</p>
                <button
                  type="button"
                  className="btn btn-xs border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
                  onClick={() => navigate("/trending-localities")}
                >
                  View all
                </button>
              </div>
              <div className="space-y-2">
                {trendingLocalities.map((item) => (
                  <div key={item} className="rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700">{item}</div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Trending News</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-ghost btn-circle text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                    onClick={() => refetchNews()}
                    disabled={newsLoading}
                    title="Refresh news"
                  >
                    <RefreshCw className={`size-4 ${newsLoading ? "animate-spin" : ""}`} />
                  </button>
                  <button type="button" className="btn btn-xs border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50" onClick={() => navigate("/news")}>View all</button>
                </div>
              </div>
              {newsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="w-full h-24 bg-slate-200 animate-pulse" />
                      <div className="p-2 space-y-2">
                        <div className="h-3 bg-slate-200 rounded animate-pulse" />
                        <div className="h-2 w-20 bg-slate-200 rounded animate-pulse" />
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
                      className="block rounded-lg border border-slate-200 overflow-hidden hover:border-indigo-200 hover:shadow-sm transition"
                    >
                      <img
                        src={news.image}
                        alt={news.title}
                        className="w-full h-24 object-cover"
                      />
                      <div className="p-2">
                        <p className="text-xs font-semibold text-slate-800 line-clamp-2">{news.title}</p>
                        <p className="mt-1 text-[10px] text-slate-500">{news.source?.name || news.source || "Unknown"}</p>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2">
                <p className="text-sm font-bold text-slate-800">Recommended for You</p>
              </div>
              <div className="space-y-2">
                {personalizedRecommendations.length > 0 ? (
                  personalizedRecommendations.slice(0, 3).map((post) => (
                    <button
                      key={`rec-${post._id}`}
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-200 p-2 text-left hover:bg-slate-50"
                      onClick={() => navigate(`/property/${post._id}`)}
                    >
                      <img src={post.mediaUrls?.[0] || post.media?.[0]} alt={post.title || "Recommendation"} className="h-12 w-16 rounded-md object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{post.title || "Property"}</p>
                        <p className="truncate text-[11px] text-slate-500">{formatMoney(post.price)} · {post.city || "India"}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">No recommendations yet</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Trending Locations</p>
                <TrendingUp className="size-4 text-slate-400" />
              </div>
              <div className="space-y-2">
                {trendingLocations.length > 0 ? (
                  trendingLocations.map((location) => (
                    <button
                      key={location.name}
                      type="button"
                      className={`flex w-full items-center justify-between rounded-lg border p-2 text-left transition ${
                        selectedTrendingLocation === location.name
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:bg-slate-50"
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
                        <MapPin className={`size-3 ${selectedTrendingLocation === location.name ? "text-indigo-600" : "text-slate-400"}`} />
                        <p className={`text-xs font-semibold ${selectedTrendingLocation === location.name ? "text-indigo-800" : "text-slate-800"}`}>{location.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {location.isNearUser && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">Near You</span>
                        )}
                        <span className="text-[11px] text-slate-500">{location.propertyCount} properties</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">No trending locations yet</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2">
                <p className="text-sm font-bold text-slate-800">Saved Searches</p>
              </div>
              <div className="space-y-2">
                {savedSearches.map((item) => (
                  <div key={item} className="rounded-lg border border-slate-200 p-2 text-xs text-slate-700">{item}</div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-800">Role Snapshot</p>
                <Eye className="size-4 text-slate-400" />
              </div>
              <div className="space-y-2">
                {roleWidgets.map((widget) => (
                  <div key={widget.title} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-[11px] text-slate-500">{widget.title}</p>
                    <p className="text-lg font-black text-slate-800">{widget.value}</p>
                    <p className="text-[11px] text-emerald-600">{widget.hint}</p>
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
        <button type="button" className="btn btn-circle fixed bottom-24 right-5 z-40 h-14 w-14 border-none bg-indigo-600 text-white shadow-xl hover:bg-indigo-500 xl:hidden" onClick={() => setIsComposerOpen(true)}>
          <Plus className="size-6" />
        </button>
      )}

      {selectedForComparison.length >= 2 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50">
          <button
            type="button"
            className="group inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            onClick={() => navigate(`/compare-properties?ids=${selectedForComparison.join(',')}`)}
          >
            <span>Compare {selectedForComparison.length} Properties</span>
          </button>
        </div>
      )}

      {selectedImage ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-6" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} alt="Property preview" className="max-h-full max-w-full rounded-2xl object-contain" />
          <button type="button" className="btn btn-sm absolute right-6 top-6 border-none bg-white text-slate-700 hover:bg-slate-100" onClick={() => setSelectedImage(null)}>
            <X className="size-4" />
            Close
          </button>
        </div>
      ) : null}

      {isComposerOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35" onClick={resetComposer}>
          <aside className="absolute right-0 top-0 h-full w-full max-w-5xl overflow-y-auto border-l border-slate-200 bg-white" onClick={(event) => event.stopPropagation()}>
            <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    <Sparkles className="size-4" />
                    Create Post
                  </p>
                  <h3 className="mt-2 text-2xl font-black text-slate-800">Step {composerStep} of 6</h3>
                </div>
                <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={resetComposer}><X className="size-4" /></button>
              </div>
              <progress className="progress progress-primary mt-3 h-2 w-full" value={composerStep} max="6" />
            </div>

            <div className="px-6 py-5">
              {composerStep === 1 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-600">What would you like to post? Recommended for {activeRole}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {recommendedPostTypes.map((postType) => {
                      const definition = POST_TYPE_DEFINITIONS[postType] || POST_TYPE_DEFINITIONS.PROPERTY_SALE;
                      const isActive = draft.postType === postType;
                      return (
                      <button
                        key={postType}
                        type="button"
                        className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}
                        onClick={() => {
                          setDraft((prev) => ({
                            ...prev,
                            postType,
                            listingType: definition.listingType,
                            propertyType: definition.propertyType,
                          }));
                        }}
                      >
                        <p className="font-semibold text-slate-800">{definition.label}</p>
                        <p className="mt-1 text-xs text-slate-500">{definition.description}</p>
                      </button>
                      );
                    })}
                  </div>

                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Other Post Types</p>
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
                            className={`rounded-2xl border p-4 text-left transition ${isActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 bg-white hover:border-indigo-200"}`}
                            onClick={() => {
                              setDraft((prev) => ({
                                ...prev,
                                postType,
                                listingType: definition.listingType,
                                propertyType: definition.propertyType,
                              }));
                            }}
                          >
                            <p className="font-semibold text-slate-800">{definition.label}</p>
                            <p className="mt-1 text-xs text-slate-500">{definition.description}</p>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              {composerStep === 2 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-600">Upload media (Max 5 files)</p>
                  <div
                    className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/30"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
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
                    <Upload className="mx-auto size-8 text-slate-400" />
                    <p className="mt-2 text-sm text-slate-600">Drag photos/videos here or click to browse</p>
                    <p className="mt-1 text-xs text-slate-500">Supports: PNG, JPEG, WEBP, GIF, MP4, WEBM, MOV (Max 50MB per file)</p>
                    {String(draft.postType || "").startsWith("REQUIREMENT_") ? (
                      <p className="mt-1 text-xs text-slate-500">Media is optional for requirement posts.</p>
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
                  </div>

                  <div className="mt-3">
                    <p className="text-xs text-slate-500 mb-2">Uploaded media ({composerMedia.length}/5):</p>
                    {composerMedia.length ? (
                      <div className="flex flex-wrap gap-2">
                        {composerMedia.map((url, idx) => {
                          const isVideo = /\.(mp4|webm|mov)(\?.*)?$/i.test(url);
                          return (
                            <div key={idx} className="relative">
                              {isVideo ? (
                                <video src={url} className="size-16 rounded-lg object-cover border border-slate-200" muted />
                              ) : (
                                <img src={url} alt={`Upload ${idx + 1}`} className="size-16 rounded-lg object-cover border border-slate-200" />
                              )}
                              <button
                                type="button"
                                className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white text-xs leading-none shadow"
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
                      <span className="text-sm text-slate-500">No media selected yet.</span>
                    )}
                  </div>
                </div>
              ) : null}

              {composerStep === 3 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-600">Add intent-specific details</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-slate-500">Title</span>
                      <input className="input input-bordered border-slate-200" value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} />
                    </label>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-slate-500">Location (Optional)</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          onClick={() => {
                            if (navigator.geolocation) {
                              navigator.geolocation.getCurrentPosition(
                                (position) => {
                                  const { latitude, longitude } = position.coords;
                                  // Reverse geocode to get city/locality using CORS proxy
                                  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)}`;
                                  fetch(proxyUrl)
                                    .then(res => res.json())
                                    .then(data => {
                                      const city = data.address.city || data.address.town || data.address.village || "";
                                      const locality = data.address.suburb || data.address.neighbourhood || "";
                                      setDraft(prev => ({
                                        ...prev,
                                        city: city || prev.city, // Always update city if we get one
                                        locality: locality || prev.locality,
                                        latitude,
                                        longitude,
                                      }));
                                      toast.success("Location captured successfully");
                                    })
                                    .catch(() => {
                                      setDraft(prev => ({ ...prev, latitude, longitude }));
                                      toast.success("Coordinates captured (city/locality not found)");
                                    });
                                },
                                (error) => {
                                  toast.error("Failed to get location. Please allow location access.");
                                }
                              );
                            } else {
                              toast.error("Geolocation is not supported by your browser");
                            }
                          }}
                        >
                          <MapPin className="size-4" />
                          Use My Current Location
                        </button>
                      </div>
                    </label>
                    <div className="form-control">
                      <label className="label-text mb-1 text-xs text-slate-500">City / Location</label>
                      <div className="relative">
                          <input
                            type="text"
                            className="input input-bordered border-slate-200 w-full"
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
                                  // Try using a CORS proxy
                                  const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`)}`;
                                  fetch(proxyUrl)
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
                          <div className="absolute z-[9999] w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {citySuggestions.map((suggestion, idx) => (
                              <button
                                key={idx}
                                type="button"
                                className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
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
                                <div className="text-sm font-medium text-slate-900">{suggestion.city}</div>
                                <div className="text-xs text-slate-500 truncate">{suggestion.display}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <label className="form-control">
                      <span className="label-text mb-1 text-xs text-slate-500">Locality</span>
                      <input className="input input-bordered border-slate-200" value={draft.locality} onChange={(event) => updateDraft("locality", event.target.value)} />
                    </label>
                    <div className="sm:col-span-2">
                      <div className="relative h-64 rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
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
                        <div className="absolute bottom-2 left-2 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs text-slate-600">
                          Click or drag pin to set location
                        </div>
                      </div>
                      {draft.latitude && draft.longitude ? (
                        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                          <MapPin className="size-3" />
                          <span>Coordinates: {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}</span>
                          <button
                            type="button"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => setDraft(prev => ({ ...prev, latitude: null, longitude: null }))}
                          >
                            Clear
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Click or drag the pin on the map to set the exact location.</p>
                      )}
                    </div>
                    <label className="form-control sm:col-span-2">
                      <span className="label-text mb-1 text-xs text-slate-500">Description</span>
                      <textarea className="textarea textarea-bordered min-h-20 border-slate-200" value={draft.caption} onChange={(event) => updateDraft("caption", event.target.value)} />
                    </label>

                    {String(draft.postType || "").startsWith("REQUIREMENT_") ? (
                      <>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Budget Min</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.budgetMin} onChange={(event) => updateDraft("budgetMin", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Budget Max</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.budgetMax} onChange={(event) => updateDraft("budgetMax", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Preferred Move-in Date</span>
                          <input type="date" className="input input-bordered border-slate-200" value={draft.moveInDate} onChange={(event) => updateDraft("moveInDate", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Property Preference</span>
                          <select className="select select-bordered border-slate-200" value={draft.requirementPropertyType} onChange={(event) => updateDraft("requirementPropertyType", event.target.value)}>
                            <option value="">Select type</option>
                            <option value="PG">PG</option>
                            <option value="Room">Room</option>
                            <option value="Flat">Flat</option>
                            <option value="Shared Flat">Shared Flat</option>
                            <option value="Independent House">Independent House</option>
                            <option value="Villa">Villa</option>
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Furnishing Preference</span>
                          <select className="select select-bordered border-slate-200" value={draft.furnishedPreference} onChange={(event) => updateDraft("furnishedPreference", event.target.value)}>
                            <option value="">Select option</option>
                            {FURNISHING_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Occupancy</span>
                          <select className="select select-bordered border-slate-200" value={draft.occupancyPreference} onChange={(event) => updateDraft("occupancyPreference", event.target.value)}>
                            <option value="">Select option</option>
                            {OCCUPANCY_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Gender Preference</span>
                          <select className="select select-bordered border-slate-200" value={draft.genderPreference} onChange={(event) => updateDraft("genderPreference", event.target.value)}>
                            <option value="">Select option</option>
                            {GENDER_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                          </select>
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Occupation</span>
                          <select className="select select-bordered border-slate-200" value={draft.occupation} onChange={(event) => updateDraft("occupation", event.target.value)}>
                            <option value="">Select option</option>
                            <option value="Student">Student</option>
                            <option value="Working Professional">Working Professional</option>
                            <option value="Business Owner">Business Owner</option>
                            <option value="Other">Other</option>
                          </select>
                        </label>
                        <label className="form-control sm:col-span-2">
                          <span className="label-text mb-1 text-xs text-slate-500">Amenities Needed (optional)</span>
                          <input className="input input-bordered border-slate-200" placeholder="Gym, security, power backup" value={draft.amenitiesText} onChange={(event) => updateDraft("amenitiesText", event.target.value)} />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Price</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Area (sqft)</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.areaSqft} onChange={(event) => updateDraft("areaSqft", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Bedrooms</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.bedrooms} onChange={(event) => updateDraft("bedrooms", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Bathrooms</span>
                          <input type="number" className="input input-bordered border-slate-200" value={draft.bathrooms} onChange={(event) => updateDraft("bathrooms", event.target.value)} />
                        </label>

                        {draft.postType === "PROPERTY_RENT" ? (
                          <>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs text-slate-500">Monthly Rent</span>
                              <input type="number" className="input input-bordered border-slate-200" value={draft.price} onChange={(event) => updateDraft("price", event.target.value)} />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs text-slate-500">Deposit Amount</span>
                              <input type="number" className="input input-bordered border-slate-200" value={draft.depositAmount} onChange={(event) => updateDraft("depositAmount", event.target.value)} />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs text-slate-500">Availability Date</span>
                              <input type="date" className="input input-bordered border-slate-200" value={draft.availableFromDate} onChange={(event) => updateDraft("availableFromDate", event.target.value)} />
                            </label>
                            <label className="form-control">
                              <span className="label-text mb-1 text-xs text-slate-500">Tenant Preference</span>
                              <select className="select select-bordered border-slate-200" value={draft.tenantType} onChange={(event) => updateDraft("tenantType", event.target.value)}>
                                <option value="">Select option</option>
                                {TENANT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                              </select>
                            </label>
                          </>
                        ) : null}
                      </>
                    )}

                    {draft.postType === "BUILDER_PROJECT" ? (
                      <>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Project Name</span>
                          <input className="input input-bordered border-slate-200" value={draft.projectName} onChange={(event) => updateDraft("projectName", event.target.value)} />
                        </label>
                        <label className="form-control">
                          <span className="label-text mb-1 text-xs text-slate-500">Launch Date</span>
                          <input type="date" className="input input-bordered border-slate-200" value={draft.launchDate} onChange={(event) => updateDraft("launchDate", event.target.value)} />
                        </label>
                        <label className="form-control sm:col-span-2">
                          <span className="label-text mb-1 text-xs text-slate-500">RERA Number</span>
                          <input className="input input-bordered border-slate-200" value={draft.reraNumber} onChange={(event) => updateDraft("reraNumber", event.target.value)} />
                        </label>
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {composerStep === 4 ? (
                <div>
                  <p className="text-sm font-semibold text-slate-600">Preview your post</p>
                  <article className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                    {composerMedia.length > 0 && isVideoUrl(composerMedia[0]) ? (
                      <video src={composerMedia[0]} alt="Preview" className="h-64 w-full object-cover" controls />
                    ) : (
                      <img src={composerMedia[0] || "https://placehold.co/1400x900?text=Preview"} alt="Preview" className="h-64 w-full object-cover" />
                    )}
                    <div className="p-4">
                      <p className="text-xs text-slate-500">{getListingBadge(draft)} · {draft.propertyType || draft.requirementPropertyType || "Real Estate"}</p>
                      <p className="mt-1 text-xl font-bold text-slate-800">{draft.title || "Untitled post"}</p>
                      <p className="mt-1 text-sm text-slate-600">{draft.caption || "No description added."}</p>
                    </div>
                  </article>
                </div>
              ) : null}

              {composerStep === 5 ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-6 text-center">
                  <p className="text-2xl font-black text-slate-800">Ready to Publish</p>
                  <p className="mt-2 text-sm text-slate-600">Your post will immediately appear in the marketplace feed.</p>
                </div>
              ) : null}

              {composerStep === 6 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <p className="text-2xl font-black text-emerald-700">Post Published</p>
                  <p className="mt-2 text-sm text-slate-600">Your post is now live and discoverable.</p>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-between">
                <button type="button" className="btn btn-ghost" disabled={composerStep === 1 || composerStep === 6} onClick={() => setComposerStep((prev) => Math.max(1, prev - 1))}>Back</button>

                {composerStep < 5 ? (
                  <button type="button" className="btn border-none bg-indigo-600 text-white hover:bg-indigo-500" disabled={!stepValid} onClick={() => setComposerStep((prev) => Math.min(5, prev + 1))}>Next</button>
                ) : composerStep === 5 ? (
                  <button type="button" className="btn border-none bg-indigo-600 text-white hover:bg-indigo-500" disabled={creating} onClick={() => createPost()}>
                    <Send className="size-4" />
                    {creating ? "Publishing..." : "Publish"}
                  </button>
                ) : (
                  <button type="button" className="btn border-none bg-indigo-600 text-white hover:bg-indigo-500" onClick={resetComposer}>Done</button>
                )}
              </div>
            </div>
          </aside>
        </div>
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
            <div className="rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800">Contact Owner</h3>
                <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={() => setContactModalOpen(false)}>
                  <X className="size-4" />
                </button>
              </div>

              {/* Property Summary */}
              <div className="rounded-xl bg-slate-50 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="size-16 rounded-lg overflow-hidden bg-slate-200 flex-shrink-0">
                    {selectedPostForContact.media?.[0] ? (
                      <img
                        src={selectedPostForContact.media[0]}
                        alt="Property"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="size-full flex items-center justify-center text-slate-400">
                        <Building2 className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 line-clamp-1">{selectedPostForContact.title || "Property"}</p>
                    <p className="text-sm text-slate-600 line-clamp-1">{selectedPostForContact.bedrooms || 0} BHK • {Number(selectedPostForContact.areaSqft || 0)} sqft</p>
                    <p className="text-sm font-bold text-indigo-600">{formatMoney(selectedPostForContact.price)}</p>
                  </div>
                </div>
              </div>

              {/* Pre-filled message */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Your Message</label>
                <textarea
                  ref={contactMessageRef}
                  className="textarea textarea-bordered w-full h-24 text-sm"
                  placeholder={`Hi ${selectedPostForContact.author?.fullName?.split(" ")[0] || "there"},\n\nI'm interested in this property. Please share more details.`}
                  defaultValue={`Hi ${selectedPostForContact.author?.fullName?.split(" ")[0] || "there"},\n\nI'm interested in this property. Please share more details.`}
                />
              </div>

              {/* Quick Actions */}
              <div className="mb-4">
                <p className="text-xs font-medium text-slate-500 mb-2">Quick Actions</p>
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
                      className="btn btn-xs border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
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
                className="btn w-full border-none bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => {
                  const message = contactMessageRef.current?.value || "";
                  console.log("Send button clicked, message:", message);
                  handleSendContactMessage(message);
                }}
              >
                <Send className="size-4" />
                Send Message
              </button>

              <p className="mt-3 text-center text-xs text-slate-500">
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
      />
    </AppShell>
  );
}
