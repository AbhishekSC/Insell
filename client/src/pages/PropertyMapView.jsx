import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Circle, Polyline, useMap } from "react-leaflet";
import { MapPin, Bed, Bath, Square, Building2, Home, Filter, X, SlidersHorizontal, GraduationCap, Hospital, Train, ShoppingBag, ChevronDown, ArrowLeft, Search, LocateFixed, Loader2 } from "lucide-react";
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

// Small teardrop pin. Price + details live in a hover tooltip / click popup
// instead of a fat always-on price pill (which overlapped badly when zoomed
// out). Selected property gets a distinct colour.
const createPinIcon = (isSelected = false) => {
  const fill = isSelected ? "#f59e0b" : "#2563eb";
  return L.divIcon({
    className: "property-pin",
    html: `
      <svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
        <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z"
          fill="${fill}" stroke="#ffffff" stroke-width="2"/>
        <circle cx="13" cy="13" r="4.5" fill="#ffffff"/>
      </svg>
    `,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
    tooltipAnchor: [0, -30],
  });
};

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
  }
};

const createAmenityIcon = (type) => {
  const config = AMENITY_CONFIG[type];
  const IconComponent = config.icon;
  
  return L.divIcon({
    className: "amenity-marker",
    html: `
      <div class="bg-base-100 rounded-full shadow-lg border-2 flex items-center justify-center" style="width: 36px; height: 36px; border-color: ${config.color};">
        <div style="color: ${config.color}; font-size: 16px;">
          ${config.label === "Schools" ? "🏫" : config.label === "Hospitals" ? "🏥" : config.label === "Metro" ? "🚇" : "🏬"}
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

function MapViewUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

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
  const [selectedProperty, setSelectedProperty] = useState(null);
  // Separate from selectedProperty on purpose: closing the selected-property
  // card shouldn't also wipe the amenity markers/radius off the map.
  const [amenitiesAnchor, setAmenitiesAnchor] = useState(null);

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
  const amenityFilters = { schools: true, hospitals: true, metro: true, malls: true };

  const { data, isLoading, error } = useQuery({
    queryKey: ["propertyFeed", "map"],
    queryFn: async () => {
      const response = await axiosInstance.get("/posts?limit=100");
      return response.data?.data || { posts: [] };
    },
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
      
      const response = await axiosInstance.get(`/location/search?q=${encodeURIComponent(debouncedQuery)}&type=all`);
      return response.data?.data || [];
    },
    enabled: debouncedQuery.length >= 2,
    retry: false, // Don't retry on rate limit errors
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
      // Frame on the user's own location if we have one, else the country.
      return myPoint ? { center: myPoint, zoom: 12 } : { center: [20.5937, 78.9629], zoom: 5 };
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

  // Update map center when filters change
  useEffect(() => {
    setMapCenter(mapView.center);
    setMapZoom(mapView.zoom);
  }, [mapView]);


  const formatPrice = (price) => {
    if (!price) return "Price on request";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(price);
  };

  const handleMarkerClick = (property) => {
    setMapCenter([property.latitude, property.longitude]);
    setSelectedProperty(property);
    setAmenitiesAnchor(property);
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
            <MapViewUpdater center={mapCenter} zoom={mapZoom} />

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

            {properties.map((property) => {
              const isSel = selectedProperty?._id === property._id;
              return (
              <Marker
                key={property._id}
                position={[property.latitude, property.longitude]}
                icon={createPinIcon(isSel)}
                eventHandlers={{
                  click: () => {
                    if (isMobile && isSel) {
                      navigate(`/property/${property._id}`);
                    } else {
                      handleMarkerClick(property);
                    }
                  },
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -6]}
                  opacity={1}
                  permanent={isMobile && isSel}
                  interactive={isMobile && isSel}
                  className="pin-price-tooltip"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => isMobile && isSel && navigate(`/property/${property._id}`)}
                  >
                    <span className="font-bold text-primary">{formatPrice(property.price)}</span>
                    {(property.locality || property.city) && (
                      <span className="block text-[10px] text-base-content/60">
                        {property.locality || property.city}
                      </span>
                    )}
                    {isMobile && isSel && (
                      <span className="mt-0.5 block text-[10px] font-semibold text-primary">View details ›</span>
                    )}
                  </div>
                </Tooltip>
                {!isMobile && (
                <Popup
                  maxWidth={200}
                  className="custom-popup"
                >
                  <div className="p-0 w-[172px]">
                    {property.mediaUrls?.[0] && (
                      <img
                        src={property.mediaUrls[0]}
                        alt={property.title}
                        className="w-full h-20 object-cover rounded-t-lg"
                      />
                    )}
                    <div className="p-2">
                      <h3 className="text-xs font-bold text-base-content mb-1 line-clamp-2">
                        {property.title || "Property"}
                      </h3>
                      <p className="text-sm font-bold text-primary mb-1.5">
                        {formatPrice(property.price)}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-base-content/70 mb-1.5">
                        <MapPin className="size-3 text-base-content/50 shrink-0" />
                        <span className="truncate">{property.city || "City"}</span>
                        {property.locality && <span className="truncate">· {property.locality}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-base-content/70 mb-2 flex-wrap">
                        {property.bedrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bed className="size-3 text-base-content/50" />
                            {property.bedrooms} BHK
                          </span>
                        )}
                        {property.bathrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bath className="size-3 text-base-content/50" />
                            {property.bathrooms}
                          </span>
                        )}
                        {property.areaSqft > 0 && (
                          <span className="flex items-center gap-1">
                            <Square className="size-3 text-base-content/50" />
                            {property.areaSqft.toLocaleString()} sqft
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/property/${property._id}`);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-white rounded-full font-semibold shadow-lg shadow-primary/20 hover:bg-primary hover:shadow-xl transition-all duration-200"
                      >
                        <Home className="size-3" />
                        View Details
                      </button>
                    </div>
                  </div>
                </Popup>
                )}
              </Marker>
              );
            })}

            {/* Deep-linked property that isn't in the map's 100-item list —
                render its marker so "Live Location" always lands on a pin. */}
            {deepLinkedProperty?.latitude != null && deepLinkedProperty?.longitude != null
              && !properties.some((p) => p._id === deepLinkedProperty._id) && (
              <Marker
                position={[deepLinkedProperty.latitude, deepLinkedProperty.longitude]}
                icon={createPinIcon(true)}
                eventHandlers={{
                  click: () => {
                    if (isMobile && selectedProperty?._id === deepLinkedProperty._id) {
                      navigate(`/property/${deepLinkedProperty._id}`);
                    } else {
                      handleMarkerClick(deepLinkedProperty);
                    }
                  },
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -6]}
                  opacity={1}
                  permanent={isMobile && selectedProperty?._id === deepLinkedProperty._id}
                  interactive={isMobile && selectedProperty?._id === deepLinkedProperty._id}
                  className="pin-price-tooltip"
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      isMobile && selectedProperty?._id === deepLinkedProperty._id &&
                      navigate(`/property/${deepLinkedProperty._id}`)
                    }
                  >
                    <span className="font-bold text-primary">{formatPrice(deepLinkedProperty.price)}</span>
                    {isMobile && selectedProperty?._id === deepLinkedProperty._id && (
                      <span className="mt-0.5 block text-[10px] font-semibold text-primary">View details ›</span>
                    )}
                  </div>
                </Tooltip>
                {!isMobile && (
                <Popup maxWidth={200}>
                  <div className="p-2 w-[172px]">
                    <h3 className="text-xs font-bold text-base-content mb-1 line-clamp-2">{deepLinkedProperty.title || "Property"}</h3>
                    <p className="text-sm font-bold text-primary mb-1">{formatPrice(deepLinkedProperty.price)}</p>
                    {distanceToFocusKm != null && (
                      <p className="text-[11px] font-semibold" style={{ color: YOU_ARE_HERE_COLOR }}>{formatKm(distanceToFocusKm)} from you</p>
                    )}
                    <button
                      onClick={(e) => { e.preventDefault(); navigate(`/property/${deepLinkedProperty._id}`); }}
                      className="mt-1.5 w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-primary text-white rounded-full font-semibold"
                    >
                      <Home className="size-3" /> View Details
                    </button>
                  </div>
                </Popup>
                )}
              </Marker>
            )}

            {/* Amenity Markers — tied to amenitiesAnchor, not selectedProperty, so
                these stay on the map even after the property card is closed */}
            {amenitiesAnchor && amenitiesData?.map((amenity) => (
              <Marker
                key={`amenity-${amenity.id}`}
                position={[amenity.lat, amenity.lng]}
                icon={createAmenityIcon(amenity.type)}
              >
                <Popup maxWidth={280}>
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">
                        {amenity.type === 'schools' ? '🏫' : amenity.type === 'hospitals' ? '🏥' : amenity.type === 'metro' ? '🚇' : '🏬'}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base-content text-sm">{amenity.name}</h4>
                        <p className="text-xs text-base-content/70">
                          {AMENITY_CONFIG[amenity.type]?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-base-200">
                      <p className="text-xs text-base-content/60">
                        <MapPin className="size-3 inline mr-1" />
                        {amenity.distance}m away
                      </p>
                      <span className="text-xs font-medium text-primary">
                        {amenity.distance < 500 ? 'Very Close' : amenity.distance < 1000 ? 'Close' : 'Nearby'}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Amenities search radius — tied to amenitiesAnchor so it persists
                after the selected-property card is closed */}
            {amenitiesAnchor?.latitude && amenitiesAnchor?.longitude && (
              <Circle
                center={[amenitiesAnchor.latitude, amenitiesAnchor.longitude]}
                radius={amenitiesResult?.radius || 2000}
                pathOptions={{
                  color: '#4f46e5',
                  fillColor: '#4f46e5',
                  fillOpacity: 0.06,
                  weight: 1.5,
                  dashArray: '6 6'
                }}
              />
            )}

            {/* Search radius circles for location filters */}
            {locationFilters.city && (
              <Circle
                center={mapView.center}
                radius={5000} // 5km radius for city search
                pathOptions={{
                  color: '#6366f1',
                  fillColor: '#6366f1',
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
            )}
            {locationFilters.state && !locationFilters.city && (
              <Circle
                center={mapView.center}
                radius={50000} // 50km radius for state search
                pathOptions={{
                  color: '#8b5cf6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.05,
                  weight: 2
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
                  }}
                  onFocus={() => setShowSuggestions({ ...showSuggestions, area: true })}
                  onBlur={() => setTimeout(() => setShowSuggestions({ ...showSuggestions, area: false }), 200)}
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
                    locationSuggestions.slice(0, 10).map((loc) => (
                      <button
                        key={loc.displayName}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearchQuery(loc.locality || loc.name);
                          setSearchSelection({
                            lat: loc.lat,
                            lng: loc.lng,
                            zoom: loc.locality ? 14 : loc.city ? 12 : 8,
                          });
                          setShowSuggestions({ ...showSuggestions, area: false });
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-sm transition-colors hover:bg-base-200"
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

          {/* Selected Property Badge — the marker's own Popup already shows
              image/title/price/View Details on mobile, so this richer
              amenities panel is desktop-only to avoid a redundant second card */}
          {selectedProperty && (
            <div className="hidden sm:block bg-base-100/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-3 border border-base-300 w-full sm:max-w-xs">
              <div className="flex items-start gap-2 sm:gap-3">
                {selectedProperty.mediaUrls?.[0] && (
                  <img
                    src={selectedProperty.mediaUrls[0]}
                    alt={selectedProperty.title}
                    className="w-9 h-9 sm:w-12 sm:h-12 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs text-base-content/60 mb-0.5 sm:mb-1">Selected Property</p>
                  <h4 className="text-xs sm:text-sm font-semibold text-base-content truncate">{selectedProperty.title || "Property"}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] sm:text-xs text-primary font-medium">{formatPrice(selectedProperty.price)}</p>
                    {distanceToFocusKm != null && selectedProperty?._id === focusProperty?._id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        <MapPin className="size-2.5" />
                        {formatKm(distanceToFocusKm)} away
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="text-base-content/50 hover:text-base-content/70"
                >
                  <X className="size-4" />
                </button>
              </div>
              {amenitiesLoading && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                    <p className="text-xs text-base-content/60">Loading nearby amenities...</p>
                  </div>
                </div>
              )}
              {!amenitiesLoading && amenitiesError && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <p className="text-xs text-error">Couldn't load nearby amenities. Try again in a moment.</p>
                </div>
              )}
              {!amenitiesLoading && !amenitiesError && amenitiesData?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <p className="text-xs text-base-content/60 mb-2">{amenitiesData.length} amenities within {amenitiesRadiusKm}km</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {amenitiesData.slice(0, 5).map((amenity) => (
                      <div key={amenity.id} className="flex items-center gap-2 text-xs">
                        <span>
                          {amenity.type === 'schools' ? '🏫' : amenity.type === 'hospitals' ? '🏥' : amenity.type === 'metro' ? '🚇' : '🏬'}
                        </span>
                        <span className="truncate text-base-content">{amenity.name}</span>
                        <span className="text-base-content/50 ml-auto">{amenity.distance}m</span>
                      </div>
                    ))}
                    {amenitiesData.length > 5 && (
                      <p className="text-xs text-base-content/50">+{amenitiesData.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
              {!amenitiesLoading && !amenitiesError && amenitiesData?.length === 0 && (
                <div className="mt-3 pt-3 border-t border-base-200">
                  <p className="text-xs text-base-content/50">No amenities found within {amenitiesRadiusKm}km.</p>
                </div>
              )}
            </div>
          )}

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

        {/* Filter + live-location — compact floating buttons, bottom-right */}
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-2">
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
