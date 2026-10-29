import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, Polyline, useMap, useMapEvents } from "react-leaflet";
import { MapPin, Bed, Bath, Square, Home, X, SlidersHorizontal, GraduationCap, Hospital, Train, ShoppingBag, Trees, ChevronDown, ArrowLeft, Search, LocateFixed, Loader2 } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import axiosInstance from "../lib/axios";
import MobileBottomNav from "../components/MobileBottomNav";
import { useLiveLocation } from "../hooks/useLiveLocation";

// Great-circle distance in km.
function haversineKm(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function formatKm(km) {
  if (km == null) return "";
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

// Radius (metres) for the "search area" circle, from Nominatim's own extent
// for the place — half the bounding box's diagonal. Falls back to a fixed
// guess per place type when Nominatim didn't return one (e.g. a locality
// with no polygon on OSM).
const SEARCH_RADIUS_FALLBACK_KM = { locality: 3, city: 15, state: 80 };
function searchAreaRadiusMeters(loc) {
  const [south, north, west, east] = Array.isArray(loc?.boundingbox) ? loc.boundingbox : [];
  if ([south, north, west, east].every(Number.isFinite)) {
    const diagonalKm = haversineKm([south, west], [north, east]);
    if (diagonalKm > 0) return (diagonalKm / 2) * 1000;
  }
  const fallbackKm = SEARCH_RADIUS_FALLBACK_KM[loc?.type] ?? SEARCH_RADIUS_FALLBACK_KM.city;
  return fallbackKm * 1000;
}

// "You are here" marker — a pulsing red dot, deliberately a different colour
// from the blue property price pins so it stands out.
const YOU_ARE_HERE_COLOR = "#dc2626";
const youAreHereIcon = L.divIcon({
  className: "you-are-here-marker",
  html: `
    <span style="position:relative;display:block;width:20px;height:20px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:${YOU_ARE_HERE_COLOR};opacity:.3;animation:yah-pulse 2s ease-out infinite;"></span>
      <span style="position:absolute;inset:4px;border-radius:9999px;background:${YOU_ARE_HERE_COLOR};border:2.5px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.5);"></span>
    </span>
    <style>@keyframes yah-pulse{0%{transform:scale(1);opacity:.4}70%{transform:scale(2.8);opacity:0}100%{opacity:0}}</style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

// Compact price formatter for map pins — "25L", "1.2Cr", etc.
function formatPinPrice(price) {
  if (!price) return "₹ ?";
  if (price >= 1_00_00_000) {
    const cr = price / 1_00_00_000;
    return `₹${cr % 1 === 0 ? cr.toFixed(0) : cr.toFixed(1)}Cr`;
  }
  if (price >= 1_00_000) {
    const lakh = price / 1_00_000;
    return `₹${lakh % 1 === 0 ? lakh.toFixed(0) : lakh.toFixed(1)}L`;
  }
  if (price >= 1000) return `₹${(price / 1000).toFixed(0)}K`;
  return `₹${price}`;
}

// Price-pill pin — shows the price directly on the map as a compact badge.
// Color-coded: blue for Sale, emerald for Rent, purple for Looking for Roommate, pink for Need a Room, amber for selected.
const PIN_COLORS = { Buy: "#2563eb", Rent: "#059669", FLATMATE_OFFER: "#7c3aed", FLATMATE_SEEKING: "#db2777", default: "#2563eb" };
const PIN_SELECTED = "#f59e0b";
const pinIconCache = new Map();

function createPricePinIcon(price, listingType, isSelected = false, postType = "") {
  const flatmateColor = postType === "FLATMATE_OFFER" || postType === "FLATMATE_SEEKING" ? PIN_COLORS[postType] : null;
  const bg = isSelected ? PIN_SELECTED : (flatmateColor || PIN_COLORS[listingType] || PIN_COLORS.default);
  const label = formatPinPrice(price);
  const cacheKey = `${label}-${bg}`;
  if (pinIconCache.has(cacheKey)) return pinIconCache.get(cacheKey);

  const icon = L.divIcon({
    className: "price-pin",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;">
        <div style="background:${bg};color:#fff;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);border:1.5px solid rgba(255,255,255,.9);line-height:1.2;letter-spacing:-.2px;">
          ${label}
        </div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid ${bg};margin-top:-1px;filter:drop-shadow(0 1px 1px rgba(0,0,0,.15));"></div>
      </div>
    `,
    iconSize: [0, 0],
    iconAnchor: [0, 28],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -30],
  });
  if (!isSelected) pinIconCache.set(cacheKey, icon);
  return icon;
}

// Amenity marker icons
const AMENITY_CONFIG = {
  schools: {
    icon: GraduationCap,
    color: "#3b82f6",
    label: "Schools"
  },
  hospitals: {
    icon: Hospital,
    color: "#ef4444",
    label: "Hospitals"
  },
  metro: {
    icon: Train,
    color: "#8b5cf6",
    label: "Metro"
  },
  malls: {
    icon: ShoppingBag,
    color: "#f59e0b",
    label: "Malls"
  },
  parks: {
    icon: Trees,
    color: "#16a34a",
    label: "Parks"
  }
};

const createAmenityIcon = (type) => {
  const config = AMENITY_CONFIG[type] || AMENITY_CONFIG.schools;

  return L.divIcon({
    className: "amenity-marker",
    html: `
      <div class="bg-base-100 rounded-full shadow-lg border-2 flex items-center justify-center" style="width: 36px; height: 36px; border-color: ${config.color};">
        <div style="color: ${config.color}; font-size: 16px;">
          ${config.label === "Schools" ? "🏫" : config.label === "Hospitals" ? "🏥" : config.label === "Metro" ? "🚇" : config.label === "Parks" ? "🌳" : "🏬"}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const AMENITY_MIN_ZOOM = 14;

function MapViewUpdater({ center, zoom, onMapClick, onZoomEnd }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  useMapEvents({
    click: () => { onMapClick?.(); },
    zoomend: () => { onZoomEnd?.(map.getZoom()); },
  });
  return null;
}

const PropertyMarker = memo(function PropertyMarker({ property, isSelected, isMobile, onSelect, onNavigate }) {
  const handler = useMemo(() => ({ click: () => onSelect(property) }), [property, onSelect]);
  return (
    <Marker
      position={[property.latitude, property.longitude]}
      icon={createPricePinIcon(property.price, property.listingType, isSelected, property.postType)}
      eventHandlers={handler}
    >
      {!isMobile && (
        <Tooltip direction="top" offset={[0, -6]} opacity={1} className="pin-price-tooltip">
          {(property.locality || property.city) && (
            <span className="text-[10px] text-base-content/60">
              {property.locality || property.city}
            </span>
          )}
          {property.bedrooms > 0 && (
            <span className="text-[10px] text-base-content/60">
              {property.locality || property.city ? " · " : ""}{property.bedrooms} BHK
            </span>
          )}
        </Tooltip>
      )}
      {isMobile && (() => {
        const pt = String(property.postType || "").toUpperCase();
        const isFm = pt === "FLATMATE_OFFER" || pt === "FLATMATE_SEEKING";
        const fmMeta = property.postMeta?.flatmate || {};
        const gp = fmMeta.genderPreference;
        return (
        <Popup maxWidth={190} minWidth={20} closeButton={false} className="map-mini-popup">
          <button
            type="button"
            onClick={() => onNavigate(`/property/${property._id}`)}
            className="block whitespace-nowrap p-0.5 text-left leading-tight"
          >
            {isFm && (
              <span className={`inline-block text-[9px] font-semibold px-1 py-0.5 rounded mb-0.5 ${
                pt === "FLATMATE_OFFER" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
              }`}>
                {pt === "FLATMATE_OFFER" ? "Roommate" : "Need Room"}
              </span>
            )}
            <span className="block text-sm font-bold text-primary">
              {!property.price ? "Price on request" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(property.price)}
            </span>
            <div className="flex items-center gap-1">
              {isFm && gp && gp !== "Any" && (
                <span className={`inline-block text-[9px] font-medium px-1 py-0.5 rounded-full ${
                  gp.toLowerCase() === "male" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" : gp.toLowerCase() === "female" ? "bg-pink-500/10 text-pink-700 dark:text-pink-400" : "bg-base-200 text-base-content/70"
                }`}>{gp}</span>
              )}
              {(property.locality || property.city) && (
                <span className="text-[11px] text-base-content/60 truncate">
                  {property.locality || property.city}
                </span>
              )}
            </div>
            <span className="mt-0.5 block text-[11px] font-semibold text-primary">View details ›</span>
          </button>
        </Popup>
        );
      })()}
    </Marker>
  );
});

export default function PropertyMapView() {
  const navigate = useNavigate();
  const { data: incomingRequests = [] } = useQuery({
    // Same query key AppShell uses for the same data — shares its cache
    // instead of firing a second, identical network request.
    queryKey: ["incomingRequests"],
    queryFn: async () => {
      const response = await axiosInstance.get("/users/friend-requests");
      return response.data?.data?.incomingRequests || [];
    },
    staleTime: 10000,
  });
  const [searchParams] = useSearchParams();
  const focusPropertyId = searchParams.get("propertyId");
  const hasAppliedFocusRef = useRef(false);

  const { location: myLoc, refresh: refreshLiveLocation, status: liveLocStatus } = useLiveLocation();
  const myPoint = useMemo(
    () => (myLoc?.lat != null && myLoc?.lon != null ? [myLoc.lat, myLoc.lon] : null),
    [myLoc?.lat, myLoc?.lon]
  );
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = useState({ min: '', max: '' });
  const [locationFilters, setLocationFilters] = useState({ state: '', city: '', area: '' });
  const [showSuggestions, setShowSuggestions] = useState({ state: false, city: false, area: false });
  // The top search bar only navigates the map — it must never hide markers,
  // so it's kept separate from locationFilters (which the Filters panel uses
  // to actually filter which properties are shown).
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSelection, setSearchSelection] = useState(null);
  const [searchHighlight, setSearchHighlight] = useState(-1);
  const [selectedProperty, setSelectedProperty] = useState(null);
  // Separate from selectedProperty on purpose: closing the selected-property
  // card shouldn't also wipe the amenity markers/radius off the map.
  const [amenitiesAnchor, setAmenitiesAnchor] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(5);
  const handleZoomEnd = useCallback((z) => setCurrentZoom(z), []);

  // On phones we don't open the big Leaflet popup — first tap on a pin shows a
  // compact price tooltip, a second tap on the same pin opens the detail page.
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const onChange = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  const [showPropertyList, setShowPropertyList] = useState(false);
  // All amenity types are always shown on the map now that the toggle UI
  // has been removed from the Filters panel — kept as a plain object since
  // the amenities query still expects this shape.
  const amenityFilters = { schools: true, hospitals: true, metro: true, malls: true, parks: true };

  const { data, isLoading, error } = useQuery({
    queryKey: ["propertyFeed", "map"],
    queryFn: async () => {
      const response = await axiosInstance.get("/posts?limit=100");
      return response.data?.data || { posts: [] };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch location suggestions from API with debouncing
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery || locationFilters.state || locationFilters.city || locationFilters.area);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, locationFilters.state, locationFilters.city, locationFilters.area]);

  const { data: locationSuggestions } = useQuery({
    queryKey: ["locationSuggestions", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      
      // Type-ahead: a 429 or transient failure here should degrade quietly
      // ("No matches"), never pop a toast over the search box.
      const response = await axiosInstance.get(
        `/location/search?q=${encodeURIComponent(debouncedQuery)}&type=all`,
        { skipErrorToast: true }
      );
      return response.data?.data || [];
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });

  // When deep-linked from a post's "Live Location" button, fetch that exact
  // property directly — it might not be in the 100 the map list pulls.
  const { data: deepLinkedProperty } = useQuery({
    queryKey: ["mapFocusProperty", focusPropertyId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${focusPropertyId}`, { skipErrorToast: true });
      return res.data?.data?.post || null;
    },
    enabled: Boolean(focusPropertyId),
    staleTime: 60000,
    retry: false,
  });

  // Fetch nearby amenities when a property is selected — real Geoapify/OpenStreetMap data only.
  // The backend widens the search up to 5km on its own if nothing is found within 2km.
  const { data: amenitiesResult, isLoading: amenitiesLoading, isError: amenitiesError } = useQuery({
    queryKey: ["nearbyAmenities", amenitiesAnchor?.latitude, amenitiesAnchor?.longitude, amenityFilters],
    queryFn: async () => {
      if (!amenitiesAnchor?.latitude || !amenitiesAnchor?.longitude) return { items: [], radius: 2000 };

      const enabledTypes = Object.keys(amenityFilters).filter(type => amenityFilters[type]);
      if (enabledTypes.length === 0) return { items: [], radius: 2000 };

      const response = await axiosInstance.get(
        `/amenities/nearby?lat=${amenitiesAnchor.latitude}&lng=${amenitiesAnchor.longitude}&radius=2000&types=${enabledTypes.join(',')}`
      );
      return { items: response.data?.data || [], radius: response.data?.radius || 2000 };
    },
    enabled: !!amenitiesAnchor?.latitude && !!amenitiesAnchor?.longitude,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    retry: 1,
  });
  const amenitiesData = amenitiesResult?.items;
  const amenitiesRadiusKm = ((amenitiesResult?.radius || 2000) / 1000).toFixed(amenitiesResult?.radius % 1000 ? 1 : 0);

  const properties = useMemo(() => {
    const posts = data?.posts || [];
    let filtered = posts.filter(post => post.latitude && post.longitude);
    
    // Apply location filters
    if (locationFilters.state) {
      filtered = filtered.filter(p => 
        p.state?.toLowerCase().includes(locationFilters.state.toLowerCase())
      );
    }
    if (locationFilters.city) {
      filtered = filtered.filter(p => 
        p.city?.toLowerCase().includes(locationFilters.city.toLowerCase())
      );
    }
    if (locationFilters.area) {
      filtered = filtered.filter(p => 
        p.locality?.toLowerCase().includes(locationFilters.area.toLowerCase()) ||
        p.area?.toLowerCase().includes(locationFilters.area.toLowerCase())
      );
    }
    
    // Apply price filter
    if (priceRange.min) {
      filtered = filtered.filter(p => (p.price || 0) >= Number(priceRange.min));
    }
    if (priceRange.max) {
      filtered = filtered.filter(p => (p.price || 0) <= Number(priceRange.max));
    }
    
    // Apply area filter
    if (areaRange.min) {
      filtered = filtered.filter(p => (p.areaSqft || 0) >= Number(areaRange.min));
    }
    if (areaRange.max) {
      filtered = filtered.filter(p => (p.areaSqft || 0) <= Number(areaRange.max));
    }
    
    return filtered;
  }, [data?.posts, priceRange, areaRange, locationFilters]);

  // Separate from `properties` (which reflects search/filters) — this only
  // answers "is there any listing to plot at all," so a search/filter that
  // matches nothing doesn't tear down the whole map + search bar.
  const hasGeoTaggedProperties = useMemo(
    () => (data?.posts || []).some((post) => post.latitude && post.longitude),
    [data?.posts]
  );

  // Calculate map center and zoom based on filtered properties
  const mapView = useMemo(() => {
    // Deep-linked from a post's "Live Location" (?propertyId=...) — pin this
    // exact property at street zoom. Highest priority so the shared "recenter
    // on all properties" logic below can't stomp it once the list loads.
    const focus = deepLinkedProperty
      || (focusPropertyId && (data?.posts || []).find((p) => String(p._id) === String(focusPropertyId)));
    if (focusPropertyId && focus?.latitude != null && focus?.longitude != null) {
      return { center: [focus.latitude, focus.longitude], zoom: 16 };
    }

    // A place picked from the search bar always wins — it uses the
    // geocoder's own coordinates, so it works even when zero properties
    // happen to be there yet (averaging an empty/mismatched property list
    // previously produced NaN and stranded the map).
    if (searchSelection) {
      return { center: [searchSelection.lat, searchSelection.lng], zoom: searchSelection.zoom };
    }

    if (properties.length === 0) {
      return myPoint ? { center: myPoint, zoom: 12 } : { center: [20.5937, 78.9629], zoom: 5 };
    }

    const noFiltersActive = !locationFilters.state && !locationFilters.city;
    if (noFiltersActive && myPoint) {
      return { center: myPoint, zoom: 12 };
    }

    // If state is selected, try to find state center
    if (locationFilters.state) {
      const stateProperties = properties.filter(p => 
        p.state?.toLowerCase() === locationFilters.state.toLowerCase()
      );
      
      if (stateProperties.length > 0) {
        const avgLat = stateProperties.reduce((sum, p) => sum + p.latitude, 0) / stateProperties.length;
        const avgLng = stateProperties.reduce((sum, p) => sum + p.longitude, 0) / stateProperties.length;
        return { center: [avgLat, avgLng], zoom: 8 };
      }
    }

    // If city is selected, center on city
    if (locationFilters.city) {
      const cityProperties = properties.filter(p => 
        p.city?.toLowerCase() === locationFilters.city.toLowerCase()
      );
      
      if (cityProperties.length > 0) {
        const avgLat = cityProperties.reduce((sum, p) => sum + p.latitude, 0) / cityProperties.length;
        const avgLng = cityProperties.reduce((sum, p) => sum + p.longitude, 0) / cityProperties.length;
        return { center: [avgLat, avgLng], zoom: 12 };
      }
    }

    // Default: center on all filtered properties
    const avgLat = properties.reduce((sum, p) => sum + p.latitude, 0) / properties.length;
    const avgLng = properties.reduce((sum, p) => sum + p.longitude, 0) / properties.length;
    return { center: [avgLat, avgLng], zoom: 10 };
  }, [properties, locationFilters.state, locationFilters.city, searchSelection, focusPropertyId, deepLinkedProperty, data?.posts, myPoint]);

  useEffect(() => {
    setMapCenter(mapView.center);
    setMapZoom(mapView.zoom);
    setCurrentZoom(mapView.zoom);
  }, [mapView]);


  const formatPrice = (price) => {
    if (!price) return "Price on request";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleMarkerClick = useCallback((property) => {
    setMapCenter([property.latitude, property.longitude]);
    setSelectedProperty(property);
    setAmenitiesAnchor(property);
  }, []);

  const handleMapClick = () => {
    setSelectedProperty(null);
    setAmenitiesAnchor(null);
  };

  // Deep-linked from a post's "Live Location" button (?propertyId=...) — once
  // the property list loads, auto-select the matching one the same way a
  // manual marker click would, so its amenities panel populates immediately.
  // Guarded to run only once so it doesn't fight a user's own subsequent
  // selection on every unrelated re-render.
  useEffect(() => {
    if (!focusPropertyId || hasAppliedFocusRef.current) return;
    const match = deepLinkedProperty
      || data?.posts?.find((post) => post._id === focusPropertyId);
    if (match?.latitude == null || match?.longitude == null) return;
    hasAppliedFocusRef.current = true;
    // Centering/zoom is handled by the mapView memo (focus is its top
    // priority). Here we just select it so the card + amenities populate.
    setSelectedProperty(match);
    setAmenitiesAnchor(match);
  }, [focusPropertyId, deepLinkedProperty, data?.posts]);

  const clearFilters = () => {
    setPriceRange({ min: '', max: '' });
    setAreaRange({ min: '', max: '' });
    setLocationFilters({ state: '', city: '', area: '' });
  };

  const isLocating = liveLocStatus === "locating";
  const handleLocateMe = async () => {
    if (!window.isSecureContext) {
      toast.error("Location needs a secure (https) connection");
      return;
    }
    toast.loading("Finding your location...", { id: "locate-me" });
    // Goes through the shared live-location service — persists to
    // user.locationDetails so the pin sticks and every feature stays in sync.
    const r = await refreshLiveLocation();
    if (r?.ok) {
      setMapCenter([r.lat, r.lon]);
      setMapZoom(15);
      toast.success("Centered on your location", { id: "locate-me" });
    } else if (r?.denied) {
      toast.error("Location permission denied — enable it in your browser settings", { id: "locate-me" });
    } else {
      toast.error("Couldn't access your location", { id: "locate-me" });
    }
  };


  // The property currently in focus (deep-linked or clicked) — used for the
  // "distance from you" line.
  const focusProperty = selectedProperty || deepLinkedProperty || null;
  const focusPoint = focusProperty?.latitude != null && focusProperty?.longitude != null
    ? [focusProperty.latitude, focusProperty.longitude]
    : null;
  const distanceToFocusKm = myPoint && focusPoint ? haversineKm(myPoint, focusPoint) : null;

  const hasActiveFilters = priceRange.min || priceRange.max || areaRange.min || areaRange.max || 
                           locationFilters.state || locationFilters.city || locationFilters.area;

  return (
    <div className="min-h-screen bg-base-200">
      {/* Map Container */}
      <div className="relative h-[calc(100dvh-4rem)] xl:h-dvh">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
              <p className="mt-4 text-base-content/70">Loading properties...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="size-16 text-base-content/40 mx-auto mb-4" />
              <p className="text-lg text-base-content/70 mb-4">Failed to load properties</p>
              <button
                onClick={() => navigate("/marketplace")}
                className="btn btn-primary"
              >
                Back to Marketplace
              </button>
            </div>
          </div>
        ) : !hasGeoTaggedProperties ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="size-16 text-base-content/40 mx-auto mb-4" />
              <p className="text-lg text-base-content/70 mb-4">No properties with location data</p>
              <button
                onClick={() => navigate("/marketplace")}
                className="btn btn-primary"
              >
                Back to Marketplace
              </button>
            </div>
          </div>
        ) : (
          <MapContainer
            center={mapCenter}
            zoom={mapZoom}
            className="h-full w-full"
            style={{ zIndex: 1 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewUpdater center={mapCenter} zoom={mapZoom} onMapClick={handleMapClick} onZoomEnd={handleZoomEnd} />

            {/* Searched place — a soft circle over roughly the area the user
                searched for, so "these pins belong to Indore" reads visually
                instead of the pins just floating on the base map. Clears the
                moment the search box is cleared (searchSelection -> null). */}
            {searchSelection && (
              <Circle
                center={[searchSelection.lat, searchSelection.lng]}
                radius={searchSelection.radiusMeters}
                pathOptions={{ color: "#2563eb", weight: 1.5, fillOpacity: 0.06, dashArray: "4 6" }}
                interactive={false}
              />
            )}

            {/* "You are here" */}
            {myPoint && (
              <>
                <Marker position={myPoint} icon={youAreHereIcon} zIndexOffset={1000}>
                  <Popup>
                    <div className="text-xs font-semibold text-base-content">You are here</div>
                    {myLoc?.capturedAt && (
                      <div className="text-[11px] text-base-content/60">
                        {myLoc.source === "gps" ? "From your device" : "Last saved location"}
                      </div>
                    )}
                  </Popup>
                </Marker>
                {myLoc?.accuracyMeters > 0 && myLoc.accuracyMeters < 2000 && (
                  <Circle center={myPoint} radius={myLoc.accuracyMeters} pathOptions={{ color: YOU_ARE_HERE_COLOR, weight: 1, fillOpacity: 0.06 }} />
                )}
              </>
            )}

            {/* Line + distance to the property you came from Near Me / clicked */}
            {myPoint && focusPoint && (
              <>
                <Polyline
                  positions={[myPoint, focusPoint]}
                  pathOptions={{ color: YOU_ARE_HERE_COLOR, weight: 2, dashArray: "6 8", opacity: 0.85 }}
                >
                  <Popup>
                    <div className="text-xs font-semibold" style={{ color: YOU_ARE_HERE_COLOR }}>
                      {formatKm(distanceToFocusKm)} from you
                    </div>
                  </Popup>
                </Polyline>
                <Marker
                  position={[(myPoint[0] + focusPoint[0]) / 2, (myPoint[1] + focusPoint[1]) / 2]}
                  interactive={false}
                  icon={L.divIcon({
                    className: "distance-label",
                    html: `<span style="background:${YOU_ARE_HERE_COLOR};color:#fff;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3);">${formatKm(distanceToFocusKm)} away</span>`,
                    iconSize: [1, 1],
                    iconAnchor: [0, 0],
                  })}
                />
              </>
            )}

            {properties.map((property) => (
              <PropertyMarker
                key={property._id}
                property={property}
                isSelected={selectedProperty?._id === property._id}
                isMobile={isMobile}
                onSelect={handleMarkerClick}
                onNavigate={navigate}
              />
            ))}

            {/* Deep-linked property that isn't in the map's 100-item list —
                render its marker so "Live Location" always lands on a pin. */}
            {deepLinkedProperty?.latitude != null && deepLinkedProperty?.longitude != null
              && !properties.some((p) => p._id === deepLinkedProperty._id) && (
              <Marker
                position={[deepLinkedProperty.latitude, deepLinkedProperty.longitude]}
                icon={createPricePinIcon(deepLinkedProperty.price, deepLinkedProperty.listingType, true, deepLinkedProperty.postType)}
                eventHandlers={{ click: () => handleMarkerClick(deepLinkedProperty) }}
              >
                {!isMobile && (deepLinkedProperty.locality || deepLinkedProperty.city) && (
                  <Tooltip direction="top" offset={[0, -6]} opacity={1} className="pin-price-tooltip">
                    <span className="text-[10px] text-base-content/60">
                      {deepLinkedProperty.locality || deepLinkedProperty.city}
                    </span>
                  </Tooltip>
                )}
                {isMobile && (
                  <Popup
                    maxWidth={170}
                    minWidth={20}
                    closeButton={false}
                    className="map-mini-popup"
                  >
                    <button
                      type="button"
                      onClick={() => navigate(`/property/${deepLinkedProperty._id}`)}
                      className="block whitespace-nowrap p-0.5 text-left leading-tight"
                    >
                      <span className="block text-sm font-bold text-primary">{formatPrice(deepLinkedProperty.price)}</span>
                      {distanceToFocusKm != null && (
                        <span className="block text-[11px] font-semibold" style={{ color: YOU_ARE_HERE_COLOR }}>
                          {formatKm(distanceToFocusKm)} from you
                        </span>
                      )}
                      <span className="mt-0.5 block text-[11px] font-semibold text-primary">View details ›</span>
                    </button>
                  </Popup>
                )}
              </Marker>
            )}

            {/* Amenity Markers — only visible at street zoom (≥14) to reduce clutter
                when zoomed out. Tied to amenitiesAnchor, not selectedProperty. */}
            {amenitiesAnchor && currentZoom >= AMENITY_MIN_ZOOM && amenitiesData?.map((amenity) => {
              const emoji = amenity.type === 'schools' ? '🏫' : amenity.type === 'hospitals' ? '🏥' : amenity.type === 'metro' ? '🚇' : amenity.type === 'parks' ? '🌳' : '🏬';
              const proximityColor = amenity.distance < 500 ? '#16a34a' : amenity.distance < 1000 ? '#2563eb' : '#6b7280';
              return (
              <Marker
                key={`amenity-${amenity.id}`}
                position={[amenity.lat, amenity.lng]}
                icon={createAmenityIcon(amenity.type)}
              >
                {/* Desktop: hover tooltip. Mobile: tap popup (tooltips don't fire on touch). */}
                {isMobile ? (
                  <Popup maxWidth={180} minWidth={80} closeButton={false} className="amenity-tip-popup">
                    <span className="text-[11px] font-semibold">{emoji} {amenity.name}</span>
                    <span className="text-[10px] font-semibold" style={{ color: proximityColor }}> · {amenity.distance}m</span>
                  </Popup>
                ) : (
                  <Tooltip direction="top" offset={[0, -18]} opacity={1} className="amenity-tip">
                    <span className="text-[11px] font-semibold">{emoji} {amenity.name}</span>
                    <span className="text-[10px] font-semibold" style={{ color: proximityColor }}> · {amenity.distance}m</span>
                  </Tooltip>
                )}
              </Marker>
              );
            })}

            {/* Amenities search radius — warm orange, distinct from the blue city/search circle */}
            {amenitiesAnchor?.latitude && amenitiesAnchor?.longitude && currentZoom >= AMENITY_MIN_ZOOM && (
              <Circle
                center={[amenitiesAnchor.latitude, amenitiesAnchor.longitude]}
                radius={amenitiesResult?.radius || 2000}
                pathOptions={{
                  color: '#f59e0b',
                  fillColor: '#f59e0b',
                  fillOpacity: 0.06,
                  weight: 1.5,
                  dashArray: '6 6'
                }}
              />
            )}

            {/* City filter radius — teal, distinct from search circle (blue) and amenity circle (orange) */}
            {locationFilters.city && (
              <Circle
                center={mapView.center}
                radius={5000}
                pathOptions={{
                  color: '#0d9488',
                  fillColor: '#0d9488',
                  fillOpacity: 0.07,
                  weight: 2,
                  dashArray: '8 6'
                }}
              />
            )}
            {locationFilters.state && !locationFilters.city && (
              <Circle
                center={mapView.center}
                radius={50000}
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.05,
                  weight: 2,
                  dashArray: '8 6'
                }}
              />
            )}
          </MapContainer>
        )}

        {/* Map overlay controls: search bar + compact property count, stacked
            in normal flow so nothing overlaps regardless of what's open */}
        <div className="absolute inset-x-4 top-4 z-[1000] flex flex-col gap-2 sm:inset-x-auto sm:left-1/2 sm:w-[380px] sm:-translate-x-1/2 lg:w-[420px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="grid size-11 shrink-0 place-items-center rounded-full border border-base-300 bg-base-100/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-base-100"
            >
              <ArrowLeft className="size-5 text-base-content" />
            </button>

            {/* Search bar — navigates the map to a place via the geocoder's
                own coordinates. Deliberately doesn't touch locationFilters,
                so it never hides existing property markers; use the
                Filters panel for that. */}
            <div className="relative min-w-0 flex-1">
              <div className="flex items-center gap-2 rounded-full border border-base-300 bg-base-100/95 px-3 py-2 shadow-lg backdrop-blur-sm sm:px-4">
                <Search className="size-4 shrink-0 text-base-content/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchSelection(null);
                    setSearchHighlight(-1);
                  }}
                  onFocus={() => setShowSuggestions({ ...showSuggestions, area: true })}
                  onBlur={() => setTimeout(() => setShowSuggestions({ ...showSuggestions, area: false }), 200)}
                  onKeyDown={(e) => {
                    const items = locationSuggestions?.slice(0, 10) || [];
                    if (!items.length) return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setSearchHighlight((prev) => (prev + 1) % items.length);
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setSearchHighlight((prev) => (prev <= 0 ? items.length - 1 : prev - 1));
                    } else if (e.key === "Enter" && searchHighlight >= 0 && searchHighlight < items.length) {
                      e.preventDefault();
                      const loc = items[searchHighlight];
                      setSearchQuery(loc.locality || loc.name);
                      setSearchSelection({
                        lat: loc.lat,
                        lng: loc.lng,
                        zoom: loc.locality ? 14 : loc.city ? 12 : 8,
                        radiusMeters: searchAreaRadiusMeters(loc),
                        label: loc.locality || loc.name,
                      });
                      setShowSuggestions({ ...showSuggestions, area: false });
                      setSearchHighlight(-1);
                    } else if (e.key === "Escape") {
                      setShowSuggestions({ ...showSuggestions, area: false });
                      setSearchHighlight(-1);
                    }
                  }}
                  placeholder="Search city, locality or area"
                  className="min-w-0 flex-1 bg-transparent text-sm text-base-content placeholder:text-base-content/50 focus:outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSearchSelection(null);
                    }}
                    className="shrink-0 text-base-content/50 hover:text-base-content"
                    aria-label="Clear search"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>

              {showSuggestions.area && searchQuery && (
                <div className="absolute z-50 mt-1.5 w-full max-h-60 overflow-y-auto rounded-xl border border-base-300 bg-base-100 shadow-lg">
                  {locationSuggestions && locationSuggestions.length > 0 ? (
                    locationSuggestions.slice(0, 10).map((loc, idx) => (
                      <button
                        key={loc.displayName}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => setSearchHighlight(idx)}
                        onClick={() => {
                          setSearchQuery(loc.locality || loc.name);
                          setSearchSelection({
                            lat: loc.lat,
                            lng: loc.lng,
                            zoom: loc.locality ? 14 : loc.city ? 12 : 8,
                            radiusMeters: searchAreaRadiusMeters(loc),
                            label: loc.locality || loc.name,
                          });
                          setShowSuggestions({ ...showSuggestions, area: false });
                          setSearchHighlight(-1);
                        }}
                        className={`w-full px-3.5 py-2.5 text-left text-sm transition-colors ${idx === searchHighlight ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
                      >
                        {loc.locality || loc.name}{loc.city ? `, ${loc.city}` : ""}
                      </button>
                    ))
                  ) : (
                    <div className="px-3.5 py-2.5 text-sm text-base-content/50">No matches</div>
                  )}
                </div>
              )}
            </div>

            {/* Property count — small, beside the search bar */}
            {!isLoading && properties.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPropertyList((prev) => !prev)}
                className="flex shrink-0 items-center gap-1 rounded-full border border-base-300 bg-base-100/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
              >
                <MapPin className="size-3.5 text-primary" />
                <span className="text-xs font-semibold text-base-content">{properties.length}</span>
                <ChevronDown className={`size-3 text-base-content/50 transition-transform ${showPropertyList ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>

          {!isLoading && locationFilters.area && properties.length === 0 && (
            <div className="rounded-xl border border-base-300 bg-base-100/95 px-3.5 py-2.5 text-sm text-base-content/70 shadow-lg backdrop-blur-sm">
              No properties found for &quot;{locationFilters.area}&quot;
            </div>
          )}

          {showPropertyList && properties.length > 0 && (
            <div className="max-h-60 overflow-y-auto divide-y divide-base-300 rounded-xl border border-base-300 bg-base-100/95 shadow-lg backdrop-blur-sm sm:max-h-72">
              {properties.map((property) => (
                <button
                  key={property._id}
                  type="button"
                  onClick={() => handleMarkerClick(property)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-left transition-colors hover:bg-primary/10 sm:gap-3 sm:px-3 sm:py-2 ${selectedProperty?._id === property._id ? "bg-primary/10" : ""}`}
                >
                  {property.mediaUrls?.[0] ? (
                    <img
                      src={property.mediaUrls[0]}
                      alt={property.title}
                      className="h-7 w-7 shrink-0 rounded-lg object-cover sm:h-10 sm:w-10"
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-base-200 sm:h-10 sm:w-10" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-semibold text-base-content sm:text-xs">{property.title || "Property"}</p>
                    <p className="text-[11px] font-medium text-primary sm:text-xs">{formatPrice(property.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Selected Property Card — desktop only; mobile uses the Leaflet Popup on the pin */}
          {selectedProperty && !isMobile && (() => {
            const sp = selectedProperty;
            const spType = String(sp.postType || "").toUpperCase();
            const spIsFlatmate = spType === "FLATMATE_OFFER" || spType === "FLATMATE_SEEKING";
            const spFm = sp.postMeta?.flatmate || {};
            const spGender = spFm.genderPreference?.toLowerCase();
            return (
            <div className="bg-base-100/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2.5 border border-base-300 w-full max-w-[280px] sm:max-w-xs">

              <div className="flex items-start gap-2.5">
                {sp.mediaUrls?.[0] && (
                  <img
                    src={sp.mediaUrls[0]}
                    alt={sp.title}
                    className="size-11 sm:size-14 object-cover rounded-lg shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  {spIsFlatmate && (
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        spType === "FLATMATE_OFFER"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      }`}>
                        {spType === "FLATMATE_OFFER" ? "Looking for Roommate" : "Need a Room"}
                      </span>
                      {spFm.genderPreference && spFm.genderPreference !== "Any" && (
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          spGender === "male" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" : spGender === "female" ? "bg-pink-500/10 text-pink-700 dark:text-pink-400" : "bg-base-200 text-base-content/70"
                        }`}>
                          {spFm.genderPreference}
                        </span>
                      )}
                    </div>
                  )}
                  <h4 className="text-xs sm:text-sm font-semibold text-base-content truncate">{sp.title || "Property"}</h4>
                  <p className="text-xs sm:text-sm text-primary font-bold">
                    {spIsFlatmate
                      ? spType === "FLATMATE_OFFER"
                        ? `₹${(spFm.rentPerPerson || sp.price || 0).toLocaleString("en-IN")}/mo`
                        : spFm.budgetMin && spFm.budgetMax
                          ? `₹${spFm.budgetMin.toLocaleString("en-IN")} – ₹${spFm.budgetMax.toLocaleString("en-IN")}`
                          : formatPrice(sp.price)
                      : formatPrice(sp.price)}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {(sp.locality || sp.city) && (
                      <span className="text-[10px] text-base-content/60 truncate">
                        {sp.locality || sp.city}
                      </span>
                    )}
                    {distanceToFocusKm != null && sp._id === focusProperty?._id && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-bold" style={{ color: YOU_ARE_HERE_COLOR }}>
                        {formatKm(distanceToFocusKm)} away
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="text-base-content/40 hover:text-base-content/70 shrink-0"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Quick stats row */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-base-content/70">
                {spIsFlatmate ? (
                  <>
                    {spFm.roomType && (
                      <span className="flex items-center gap-1">
                        <Home className="size-3 text-base-content/50" />
                        {spFm.roomType}{spFm.occupancy > 1 ? ` · ${spFm.occupancy}-share` : ""}
                      </span>
                    )}
                    {spFm.furnishing && (
                      <span className="flex items-center gap-1">
                        <Square className="size-3 text-base-content/50" />
                        {spFm.furnishing}
                      </span>
                    )}
                    {spFm.availableFrom && (
                      <span className="text-[10px] text-base-content/50">
                        From {spFm.availableFrom}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    {sp.bedrooms > 0 && (
                      <span className="flex items-center gap-1">
                        <Bed className="size-3 text-base-content/50" />
                        {sp.bedrooms} BHK
                      </span>
                    )}
                    {sp.bathrooms > 0 && (
                      <span className="flex items-center gap-1">
                        <Bath className="size-3 text-base-content/50" />
                        {sp.bathrooms}
                      </span>
                    )}
                    {sp.areaSqft > 0 && (
                      <span className="flex items-center gap-1">
                        <Square className="size-3 text-base-content/50" />
                        {sp.areaSqft.toLocaleString()} sqft
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Amenities — compact, desktop only */}
              <div className="hidden sm:block">
                {amenitiesLoading && (
                  <div className="mt-2 pt-2 border-t border-base-200">
                    <div className="flex items-center gap-2">
                      <div className="size-2.5 bg-primary rounded-full animate-pulse" />
                      <p className="text-[11px] text-base-content/60">Loading amenities...</p>
                    </div>
                  </div>
                )}
                {!amenitiesLoading && !amenitiesError && amenitiesData?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-base-200">
                    <p className="text-[10px] text-base-content/50 mb-1">{amenitiesData.length} amenities within {amenitiesRadiusKm}km</p>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {amenitiesData.slice(0, 3).map((amenity) => (
                        <div key={amenity.id} className="flex items-center gap-1.5 text-[11px]">
                          <span className="text-xs">
                            {amenity.type === 'schools' ? '🏫' : amenity.type === 'hospitals' ? '🏥' : amenity.type === 'metro' ? '🚇' : amenity.type === 'parks' ? '🌳' : '🏬'}
                          </span>
                          <span className="truncate text-base-content/70">{amenity.name}</span>
                          <span className="text-base-content/40 ml-auto shrink-0">{amenity.distance}m</span>
                        </div>
                      ))}
                      {amenitiesData.length > 3 && (
                        <p className="text-[10px] text-base-content/40">+{amenitiesData.length - 3} more</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => navigate(`/property/${sp._id}`)}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-white rounded-full font-semibold shadow-sm hover:shadow-md transition-all"
              >
                <Home className="size-3" />
                View Details
              </button>
            </div>
            );
          })()}

        </div>

        {/* Filter Panel — anchored just above the Filter button, bottom-right,
            for both mobile and desktop */}
        {showFilters && (
          <div className="absolute bottom-[7.5rem] right-4 z-[1000] w-72 max-h-[calc(100dvh-10rem)] overflow-y-auto rounded-xl border border-base-300 bg-base-100/95 p-3 shadow-xl backdrop-blur-sm text-xs sm:w-80 sm:p-5 sm:text-sm">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <h3 className="text-sm font-bold text-base-content sm:text-base">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] font-medium text-primary hover:text-primary sm:text-xs"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Price Filter */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-base-content mb-1.5 sm:mb-2">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-base-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-base-content/50">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-base-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Area Filter */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-base-content mb-1.5 sm:mb-2">Area Range (sq ft)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-base-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <span className="text-base-content/50">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-base-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            {/* Results Count */}
            <div className="pt-3 border-t border-base-200">
              <p className="text-sm text-base-content/70">
                Showing <span className="font-semibold text-base-content">{properties.length}</span> properties
              </p>
            </div>
          </div>
        )}

        {/* Pin color legend — bottom-left, just above mobile bottom nav */}
        <div className="absolute bottom-2 left-4 z-[1000] flex items-center gap-2 rounded-lg border border-base-300 bg-base-100/95 px-2.5 py-1.5 shadow-lg backdrop-blur-sm sm:bottom-4">
          <span className="flex items-center gap-1 text-[10px] font-medium text-base-content/70">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: "#2563eb" }} />Sale
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-base-content/70">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: "#059669" }} />Rent
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-base-content/70">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: "#7c3aed" }} />Room
          </span>
          <span className="flex items-center gap-1 text-[10px] font-medium text-base-content/70">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: "#db2777" }} />Flatmate
          </span>
        </div>

        {/* Filter + live-location — compact floating buttons, bottom-right */}
        <div className="absolute bottom-2 right-4 z-[1000] flex flex-col gap-2 sm:bottom-4">
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            aria-label="Go to my location"
            className="grid size-11 place-items-center rounded-full border border-base-300 bg-base-100/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-base-100 disabled:opacity-70"
          >
            {isLocating ? (
              <Loader2 className="size-5 animate-spin text-primary" />
            ) : (
              <LocateFixed className="size-5 text-primary" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-label="Filters"
            className="relative grid size-11 place-items-center rounded-full border border-base-300 bg-base-100/95 shadow-lg backdrop-blur-sm transition-colors hover:bg-base-100"
          >
            <SlidersHorizontal className="size-5 text-primary" />
            {hasActiveFilters && (
              <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-base-100" />
            )}
          </button>
        </div>
      </div>

      <MobileBottomNav connectionsCount={incomingRequests.length} />
    </div>
  );
}
