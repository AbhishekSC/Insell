import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import { ArrowLeft, MapPin, IndianRupee, Bed, Bath, Square, Building2, Home, Filter, X, SlidersHorizontal, GraduationCap, Hospital, Train, ShoppingBag } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";

// Custom marker icon
const createCustomIcon = (price) => {
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price).replace("₹", "").replace(",", "");
  
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div class="bg-indigo-600 text-white px-3 py-2 rounded-full shadow-lg text-xs font-bold whitespace-nowrap">
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
  const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
  const [mapZoom, setMapZoom] = useState(5);
  const [showFilters, setShowFilters] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [areaRange, setAreaRange] = useState({ min: '', max: '' });
  const [locationFilters, setLocationFilters] = useState({ state: '', city: '', area: '' });
  const [showSuggestions, setShowSuggestions] = useState({ state: false, city: false, area: false });
  const [selectedProperty, setSelectedProperty] = useState(null);
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

  const { data: locationSuggestions, isLoading: locationLoading, error: locationError } = useQuery({
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
    queryKey: ["nearbyAmenities", selectedProperty?.latitude, selectedProperty?.longitude, amenityFilters],
    queryFn: async () => {
      if (!selectedProperty?.latitude || !selectedProperty?.longitude) return { items: [], radius: 2000 };

      const enabledTypes = Object.keys(amenityFilters).filter(type => amenityFilters[type]);
      if (enabledTypes.length === 0) return { items: [], radius: 2000 };

      const response = await axiosInstance.get(
        `/amenities/nearby?lat=${selectedProperty.latitude}&lng=${selectedProperty.longitude}&radius=2000&types=${enabledTypes.join(',')}`
      );
      return { items: response.data?.data || [], radius: response.data?.radius || 2000 };
    },
    enabled: !!selectedProperty?.latitude && !!selectedProperty?.longitude,
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
  };

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate("/marketplace")}
              className="group flex items-center gap-2 px-4 py-2 rounded-full hover:bg-slate-100 transition-all duration-200"
            >
              <ArrowLeft className="size-5 text-slate-600 group-hover:text-slate-900" />
              <span className="font-medium text-slate-700 group-hover:text-slate-900">Back</span>
            </button>
            <div className="text-center">
              <h1 className="text-xl font-bold text-slate-900">Property Map View</h1>
              <p className="text-sm text-slate-500">Explore properties on the map</p>
            </div>
            <div className="w-32" />
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative h-[calc(100dvh-64px)]">
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
                icon={createCustomIcon(property.price)}
                eventHandlers={{
                  click: () => handleMarkerClick(property),
                }}
              >
                <Popup
                  maxWidth={350}
                  className="custom-popup"
                >
                  <div className="p-0 min-w-[280px]">
                    {property.mediaUrls?.[0] && (
                      <img
                        src={property.mediaUrls[0]}
                        alt={property.title}
                        className="w-full h-40 object-cover rounded-t-lg"
                      />
                    )}
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 mb-2 line-clamp-2">
                        {property.title || "Property"}
                      </h3>
                      <p className="text-xl font-bold text-indigo-600 mb-3">
                        <IndianRupee className="size-4 inline" />
                        {formatPrice(property.price)}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                        <MapPin className="size-4 text-slate-400" />
                        <span className="truncate">{property.city || "City"}</span>
                        {property.locality && <span>· {property.locality}</span>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                        {property.bedrooms > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Bed className="size-4 text-slate-400" />
                            {property.bedrooms} BHK
                          </span>
                        )}
                        {property.bathrooms > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Bath className="size-4 text-slate-400" />
                            {property.bathrooms}
                          </span>
                        )}
                        {property.areaSqft > 0 && (
                          <span className="flex items-center gap-1.5">
                            <Square className="size-4 text-slate-400" />
                            {property.areaSqft.toLocaleString()} sqft
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          navigate(`/property/${property._id}`);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-full font-semibold shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all duration-200"
                      >
                        <Home className="size-4" />
                        View Details
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Amenity Markers */}
            {selectedProperty && amenitiesData?.map((amenity) => (
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

            {/* Amenities search radius around the selected property */}
            {selectedProperty?.latitude && selectedProperty?.longitude && (
              <Circle
                center={[selectedProperty.latitude, selectedProperty.longitude]}
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

        {/* Property Count Badge */}
        {!isLoading && properties.length > 0 && (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-5 py-3 z-[1000] border border-slate-200">
            <div className="flex items-center gap-2">
              <MapPin className="size-5 text-indigo-600" />
              <div>
                <p className="text-sm font-semibold text-slate-900">{properties.length}</p>
                <p className="text-xs text-slate-500">Properties</p>
              </div>
            </div>
          </div>
        )}

        {/* Selected Property Badge */}
        {selectedProperty && (
          <div className="absolute top-20 left-4 right-4 sm:right-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-[1000] border border-slate-200 sm:max-w-xs">
            <div className="flex items-start gap-3">
              {selectedProperty.mediaUrls?.[0] && (
                <img
                  src={selectedProperty.mediaUrls[0]}
                  alt={selectedProperty.title}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500 mb-1">Selected Property</p>
                <h4 className="text-sm font-semibold text-slate-900 truncate">{selectedProperty.title || "Property"}</h4>
                <p className="text-xs text-indigo-600 font-medium">{formatPrice(selectedProperty.price)}</p>
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

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg px-4 py-3 z-[1000] border border-slate-200 hover:bg-white transition-colors"
        >
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-indigo-600" />
            <span className="text-sm font-semibold text-slate-900">Filters</span>
            {hasActiveFilters && (
              <div className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5">Active</div>
            )}
          </div>
        </button>

        {/* Filter Panel */}
        {showFilters && (
          <div className={`absolute ${selectedProperty ? "top-56 sm:top-20" : "top-20"} left-4 right-4 sm:left-auto bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-5 z-[1000] border border-slate-200 sm:w-80 max-h-[calc(100dvh-120px)] overflow-y-auto`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Filters</h3>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
              {/* Location Filters */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Location</label>
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Price Range (₹)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Area Filter */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">Area Range (sq ft)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Min"
                  value={areaRange.min}
                  onChange={(e) => setAreaRange({ ...areaRange, min: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="number"
                  placeholder="Max"
                  value={areaRange.max}
                  onChange={(e) => setAreaRange({ ...areaRange, max: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Amenity Filters */}
            {selectedProperty && (
              <div className="mb-4 pt-4 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700 mb-3">Nearby Amenities</label>
                <div className="space-y-2">
                  {Object.entries(AMENITY_CONFIG).map(([type, config]) => (
                    <label key={type} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={amenityFilters[type]}
                        onChange={(e) => setAmenityFilters({ ...amenityFilters, [type]: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-slate-700 flex items-center gap-2">
                        <span>{config.label === "Schools" ? "🏫" : config.label === "Hospitals" ? "🏥" : config.label === "Metro" ? "🚇" : "🏬"}</span>
                        {config.label}
                      </span>
                    </label>
                  ))}
                </div>
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
            )}

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
  );
}
