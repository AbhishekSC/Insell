import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { MapPin, Bed, Bath, Square, Building2, Home, Filter, X, SlidersHorizontal, GraduationCap, Hospital, Train, ShoppingBag, ChevronDown } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import MobileBottomNav from "../components/MobileBottomNav";

// Custom marker icon — selected property gets a distinct color so it's
// obvious which pin the open popup/card belongs to among many markers.
const createCustomIcon = (price, isSelected = false) => {
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price).replace("₹", "").replace(",", "");

  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="${isSelected ? "bg-amber-500" : "bg-indigo-600"} text-white px-3 py-2 rounded-full shadow-lg text-xs font-bold whitespace-nowrap${isSelected ? " ring-2 ring-white" : ""}">
        ₹${formattedPrice}
      </div>
    `,
    iconSize: [80, 30],
    iconAnchor: [40, 15],
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
      <div class="bg-white rounded-full shadow-lg border-2 flex items-center justify-center" style="width: 36px; height: 36px; border-color: ${config.color};">
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
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = useState({ min: '', max: '' });
  const [locationFilters, setLocationFilters] = useState({ state: '', city: '', area: '' });
  const [showSuggestions, setShowSuggestions] = useState({ state: false, city: false, area: false });
  const [selectedProperty, setSelectedProperty] = useState(null);
  // Separate from selectedProperty on purpose: closing the selected-property
  // card shouldn't also wipe the amenity markers/radius off the map.
  const [amenitiesAnchor, setAmenitiesAnchor] = useState(null);
  const [showPropertyList, setShowPropertyList] = useState(false);
  const [amenityFilters, setAmenityFilters] = useState({
    schools: true,
    hospitals: true,
    metro: true,
    malls: true
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["propertyFeed", "map"],
    queryFn: async () => {
      const response = await axiosInstance.get("/posts?limit=100");
      return response.data?.data || { posts: [] };
    },
  });

  // Fetch Indian states
  const { data: statesData } = useQuery({
    queryKey: ["indianStates"],
    queryFn: async () => {
      const response = await axiosInstance.get("/location/states");
      return response.data?.data || [];
    },
    staleTime: 1000 * 60 * 60 * 24, // Cache for 24 hours
  });

  // Fetch location suggestions from API with debouncing
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(locationFilters.state || locationFilters.city || locationFilters.area);
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timer);
  }, [locationFilters.state, locationFilters.city, locationFilters.area]);

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

  // Calculate map center and zoom based on filtered properties
  const mapView = useMemo(() => {
    if (properties.length === 0) {
      return { center: [20.5937, 78.9629], zoom: 5 };
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
  }, [properties, locationFilters.state, locationFilters.city]);

  // Update map center when filters change
  useEffect(() => {
    setMapCenter(mapView.center);
    setMapZoom(mapView.zoom);
  }, [mapView]);

  // Extract unique values for autocomplete suggestions with cascading logic
  const uniqueStates = useMemo(() => {
    // Use API states if available, otherwise fall back to property data
    if (statesData && statesData.length > 0) {
      return statesData;
    }
    
    const states = new Set();
    data?.posts?.forEach(post => {
      if (post.state) states.add(post.state);
    });
    const result = Array.from(states).sort();
    console.log("Unique states:", result);
    return result;
  }, [statesData, data?.posts]);

  const uniqueCities = useMemo(() => {
    // If state is selected, filter cities by state from API or property data
    const cities = new Set();
    data?.posts?.forEach(post => {
      if (post.city) {
        if (!locationFilters.state || post.state === locationFilters.state) {
          cities.add(post.city);
        }
      }
    });
    const result = Array.from(cities).sort();
    console.log("Unique cities (filtered by state):", result);
    return result;
  }, [data?.posts, locationFilters.state]);

  const uniqueLocalities = useMemo(() => {
    // If city is selected, filter localities by city from property data
    const localities = new Set();
    data?.posts?.forEach(post => {
      if (post.locality) {
        if (!locationFilters.city || post.city === locationFilters.city) {
          localities.add(post.locality);
        }
      }
      if (post.area) {
        if (!locationFilters.city || post.city === locationFilters.city) {
          localities.add(post.area);
        }
      }
    });
    const result = Array.from(localities).sort();
    console.log("Unique localities (filtered by city):", result);
    return result;
  }, [data?.posts, locationFilters.city]);

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
    const match = data?.posts?.find((post) => post._id === focusPropertyId);
    if (!match?.latitude || !match?.longitude) return;
    hasAppliedFocusRef.current = true;
    handleMarkerClick(match);
    // handleMarkerClick only recenters — it doesn't touch zoom, since a
    // manual marker click happens while already zoomed in somewhere
    // reasonable. Landing here fresh from a deep link starts at the
    // whole-India default (5), so zoom in close on this specific property
    // (street level) rather than leaving it at a wide, whole-state view.
    setMapZoom(15);
  }, [focusPropertyId, data?.posts]);

  const clearFilters = () => {
    setPriceRange({ min: '', max: '' });
    setAreaRange({ min: '', max: '' });
    setLocationFilters({ state: '', city: '', area: '' });
  };

  const hasActiveFilters = priceRange.min || priceRange.max || areaRange.min || areaRange.max || 
                           locationFilters.state || locationFilters.city || locationFilters.area;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 text-center">
          <h1 className="text-base sm:text-xl font-bold text-slate-900 leading-tight">Property Map View</h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-tight">Explore properties on the map</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[calc(100dvh-56px-4rem)] xl:h-[calc(100dvh-56px)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="mt-4 text-slate-600">Loading properties...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="size-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg text-slate-600 mb-4">Failed to load properties</p>
              <button
                onClick={() => navigate("/marketplace")}
                className="btn btn-primary"
              >
                Back to Marketplace
              </button>
            </div>
          </div>
        ) : properties.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MapPin className="size-16 text-slate-300 mx-auto mb-4" />
              <p className="text-lg text-slate-600 mb-4">No properties with location data</p>
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
            
            {properties.map((property) => (
              <Marker
                key={property._id}
                position={[property.latitude, property.longitude]}
                icon={createCustomIcon(property.price, selectedProperty?._id === property._id)}
                eventHandlers={{
                  click: () => handleMarkerClick(property),
                }}
              >
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
                      <h3 className="text-xs font-bold text-slate-900 mb-1 line-clamp-2">
                        {property.title || "Property"}
                      </h3>
                      <p className="text-sm font-bold text-indigo-600 mb-1.5">
                        {formatPrice(property.price)}
                      </p>
                      <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-1.5">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        <span className="truncate">{property.city || "City"}</span>
                        {property.locality && <span className="truncate">· {property.locality}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 mb-2 flex-wrap">
                        {property.bedrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bed className="size-3 text-slate-400" />
                            {property.bedrooms} BHK
                          </span>
                        )}
                        {property.bathrooms > 0 && (
                          <span className="flex items-center gap-1">
                            <Bath className="size-3 text-slate-400" />
                            {property.bathrooms}
                          </span>
                        )}
                        {property.areaSqft > 0 && (
                          <span className="flex items-center gap-1">
                            <Square className="size-3 text-slate-400" />
                            {property.areaSqft.toLocaleString()} sqft
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/property/${property._id}`);
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all duration-200"
                      >
                        <Home className="size-3" />
                        View Details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

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
                        <h4 className="font-semibold text-slate-900 text-sm">{amenity.name}</h4>
                        <p className="text-xs text-slate-600">
                          {AMENITY_CONFIG[amenity.type]?.label}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500">
                        <MapPin className="size-3 inline mr-1" />
                        {amenity.distance}m away
                      </p>
                      <span className="text-xs font-medium text-indigo-600">
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

        {/* Map overlay controls: property list (left) + filter toggle (right),
            stacked in normal flow so nothing overlaps regardless of what's open */}
        <div className="absolute inset-x-4 top-4 z-[1000] flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            {/* Property Count Badge / expandable property list */}
            {!isLoading && properties.length > 0 && (
              <div className="w-48 sm:w-64 max-w-[60vw] sm:max-w-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setShowPropertyList((prev) => !prev)}
                  className="w-full bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 sm:px-5 sm:py-3 border border-slate-200 flex items-center gap-1.5 sm:gap-2 text-left"
                >
                  <MapPin className="size-4 sm:size-5 text-indigo-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">{properties.length}</p>
                    <p className="text-[10px] sm:text-xs text-slate-500">Properties</p>
                  </div>
                  <ChevronDown className={`size-3.5 sm:size-4 text-slate-400 shrink-0 transition-transform ${showPropertyList ? "rotate-180" : ""}`} />
                </button>

                {showPropertyList && (
                  <div className="mt-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 max-h-60 sm:max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {properties.map((property) => (
                      <button
                        key={property._id}
                        type="button"
                        onClick={() => handleMarkerClick(property)}
                        className={`w-full flex items-center gap-2 sm:gap-3 px-2 py-1.5 sm:px-3 sm:py-2 text-left hover:bg-indigo-50 transition-colors ${selectedProperty?._id === property._id ? "bg-indigo-50" : ""}`}
                      >
                        {property.mediaUrls?.[0] ? (
                          <img
                            src={property.mediaUrls[0]}
                            alt={property.title}
                            className="w-7 h-7 sm:w-10 sm:h-10 object-cover rounded-lg shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg bg-slate-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] sm:text-xs font-semibold text-slate-900 truncate">{property.title || "Property"}</p>
                          <p className="text-[11px] sm:text-xs text-indigo-600 font-medium">{formatPrice(property.price)}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 hover:bg-white transition-colors"
            >
              <div className="flex items-center gap-1.5 sm:gap-2">
                <SlidersHorizontal className="size-4 sm:size-5 text-indigo-600" />
                <span className="hidden sm:inline text-sm font-semibold text-slate-900">Filters</span>
                {hasActiveFilters && (
                  <div className="bg-indigo-600 text-white text-[10px] sm:text-xs rounded-full px-1.5 py-0.5 sm:px-2">Active</div>
                )}
              </div>
            </button>
          </div>

          {/* Selected Property Badge — the marker's own Popup already shows
              image/title/price/View Details on mobile, so this richer
              amenities panel is desktop-only to avoid a redundant second card */}
          {selectedProperty && (
            <div className="hidden sm:block bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-3 py-2 sm:px-4 sm:py-3 border border-slate-200 w-full sm:max-w-xs">
              <div className="flex items-start gap-2 sm:gap-3">
                {selectedProperty.mediaUrls?.[0] && (
                  <img
                    src={selectedProperty.mediaUrls[0]}
                    alt={selectedProperty.title}
                    className="w-9 h-9 sm:w-12 sm:h-12 object-cover rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] sm:text-xs text-slate-500 mb-0.5 sm:mb-1">Selected Property</p>
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{selectedProperty.title || "Property"}</h4>
                  <p className="text-[11px] sm:text-xs text-indigo-600 font-medium">{formatPrice(selectedProperty.price)}</p>
                </div>
                <button
                  onClick={() => setSelectedProperty(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="size-4" />
                </button>
              </div>
              {amenitiesLoading && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-indigo-600 rounded-full animate-pulse" />
                    <p className="text-xs text-slate-500">Loading nearby amenities...</p>
                  </div>
                </div>
              )}
              {!amenitiesLoading && amenitiesError && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-red-500">Couldn't load nearby amenities. Try again in a moment.</p>
                </div>
              )}
              {!amenitiesLoading && !amenitiesError && amenitiesData?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-500 mb-2">{amenitiesData.length} amenities within {amenitiesRadiusKm}km</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {amenitiesData.slice(0, 5).map((amenity) => (
                      <div key={amenity.id} className="flex items-center gap-2 text-xs">
                        <span>
                          {amenity.type === 'schools' ? '🏫' : amenity.type === 'hospitals' ? '🏥' : amenity.type === 'metro' ? '🚇' : '🏬'}
                        </span>
                        <span className="truncate text-slate-700">{amenity.name}</span>
                        <span className="text-slate-400 ml-auto">{amenity.distance}m</span>
                      </div>
                    ))}
                    {amenitiesData.length > 5 && (
                      <p className="text-xs text-slate-400">+{amenitiesData.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}
              {!amenitiesLoading && !amenitiesError && amenitiesData?.length === 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs text-slate-400">No amenities found within {amenitiesRadiusKm}km.</p>
                </div>
              )}
            </div>
          )}

          {/* Filter Panel */}
          {showFilters && (
          <div className="w-full sm:w-80 max-w-xs sm:max-w-none sm:ml-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-3 sm:p-5 border border-slate-200 max-h-[calc(100dvh-140px)] overflow-y-auto text-xs sm:text-sm">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[11px] sm:text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Location Filters */}
              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">Location</label>
                <div className="space-y-2">
                {/* State Input with Autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="State"
                    value={locationFilters.state}
                    onChange={(e) => setLocationFilters({ ...locationFilters, state: e.target.value })}
                    onFocus={() => setShowSuggestions({ ...showSuggestions, state: true })}
                    onBlur={() => setTimeout(() => setShowSuggestions({ ...showSuggestions, state: false }), 200)}
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showSuggestions.state && locationFilters.state && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {uniqueStates
                        .filter(state => state.toLowerCase().includes(locationFilters.state.toLowerCase()))
                        .slice(0, 10)
                        .map((state) => (
                          <button
                            key={state}
                            type="button"
                            onClick={() => {
                              setLocationFilters({ ...locationFilters, state });
                              setShowSuggestions({ ...showSuggestions, state: false });
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                          >
                            {state}
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* City Input with Autocomplete - using API search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="City"
                    value={locationFilters.city}
                    onChange={(e) => setLocationFilters({ ...locationFilters, city: e.target.value })}
                    onFocus={() => setShowSuggestions({ ...showSuggestions, city: true })}
                    onBlur={() => setTimeout(() => setShowSuggestions({ ...showSuggestions, city: false }), 200)}
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showSuggestions.city && locationFilters.city && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {locationSuggestions && locationSuggestions.length > 0 ? (
                        locationSuggestions
                          .filter(loc => loc.type === 'city' || loc.city)
                          .slice(0, 10)
                          .map((loc) => (
                            <button
                              key={loc.displayName}
                              type="button"
                              onClick={() => {
                                setLocationFilters({ ...locationFilters, city: loc.city || loc.name, state: loc.state || locationFilters.state });
                                setShowSuggestions({ ...showSuggestions, city: false });
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                            >
                              {loc.city || loc.name}, {loc.state}
                            </button>
                          ))
                      ) : (
                        uniqueCities
                          .filter(city => city.toLowerCase().includes(locationFilters.city.toLowerCase()))
                          .slice(0, 10)
                          .map((city) => (
                            <button
                              key={city}
                              type="button"
                              onClick={() => {
                                setLocationFilters({ ...locationFilters, city });
                                setShowSuggestions({ ...showSuggestions, city: false });
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                            >
                              {city}
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>

                {/* Area/Locality Input with Autocomplete - using API search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Area/Locality"
                    value={locationFilters.area}
                    onChange={(e) => setLocationFilters({ ...locationFilters, area: e.target.value })}
                    onFocus={() => setShowSuggestions({ ...showSuggestions, area: true })}
                    onBlur={() => setTimeout(() => setShowSuggestions({ ...showSuggestions, area: false }), 200)}
                    className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {showSuggestions.area && locationFilters.area && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {locationSuggestions && locationSuggestions.length > 0 ? (
                        locationSuggestions
                          .filter(loc => loc.type === 'locality' || loc.locality)
                          .slice(0, 10)
                          .map((loc) => (
                            <button
                              key={loc.displayName}
                              type="button"
                              onClick={() => {
                                setLocationFilters({ ...locationFilters, area: loc.locality || loc.name, city: loc.city || locationFilters.city, state: loc.state || locationFilters.state });
                                setShowSuggestions({ ...showSuggestions, area: false });
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                            >
                              {loc.locality || loc.name}, {loc.city}
                            </button>
                          ))
                      ) : (
                        uniqueLocalities
                          .filter(locality => locality.toLowerCase().includes(locationFilters.area.toLowerCase()))
                          .slice(0, 10)
                          .map((locality) => (
                            <button
                              key={locality}
                              type="button"
                              onClick={() => {
                                setLocationFilters({ ...locationFilters, area: locality });
                                setShowSuggestions({ ...showSuggestions, area: false });
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-100 transition-colors"
                            >
                              {locality}
                            </button>
                          ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Price Filter */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Area Filter */}
            <div className="mb-3 sm:mb-4">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-1.5 sm:mb-2">Area Range (sq ft)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className="w-full px-2.5 py-1.5 sm:px-3 sm:py-2 border border-slate-200 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Amenity Filters — always visible/toggleable; amenities only load
                once a property has been selected as the search anchor */}
            <div className="mb-3 sm:mb-4 pt-3 sm:pt-4 border-t border-slate-100">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 mb-2 sm:mb-3">Nearby Amenities</label>
              <div className="space-y-1.5 sm:space-y-2">
                {Object.entries(AMENITY_CONFIG).map(([type, config]) => (
                  <label key={type} className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={amenityFilters[type]}
                      onChange={(e) => setAmenityFilters({ ...amenityFilters, [type]: e.target.checked })}
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-xs sm:text-sm text-slate-700 flex items-center gap-1.5 sm:gap-2">
                      <span>{config.label === "Schools" ? "🏫" : config.label === "Hospitals" ? "🏥" : config.label === "Metro" ? "🚇" : "🏬"}</span>
                      {config.label}
                    </span>
                  </label>
                ))}
              </div>
              {!amenitiesAnchor && (
                <p className="text-xs text-slate-400 mt-2">Select a property to load nearby amenities.</p>
              )}
              {amenitiesLoading && (
                <p className="text-xs text-slate-500 mt-2">Loading amenities...</p>
              )}
              {!amenitiesLoading && amenitiesError && (
                <p className="text-xs text-red-500 mt-2">Couldn't load nearby amenities.</p>
              )}
              {!amenitiesLoading && !amenitiesError && amenitiesData?.length > 0 && (
                <p className="text-xs text-slate-500 mt-2">{amenitiesData.length} amenities found</p>
              )}
            </div>

            {/* Results Count */}
            <div className="pt-3 border-t border-slate-100">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-900">{properties.length}</span> properties
              </p>
            </div>
            </div>
          </div>
          )}
        </div>
      </div>

      <MobileBottomNav connectionsCount={incomingRequests.length} />
    </div>
  );
}
