import React, { useState, useEffect, useId } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import { MapPin, Navigation } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getCurrentLocation, reverseGeocode } from "../utils/geolocation";

// Fix for default marker icon in Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function normalizePos(pos) {
  if (!pos) return null;
  let lat = null;
  let lng = null;
  if (Array.isArray(pos) && pos.length === 2) {
    lat = Number(pos[0]);
    lng = Number(pos[1]);
  } else if (typeof pos === "object") {
    lat = Number(pos.lat ?? pos.latitude);
    lng = Number(pos.lng ?? pos.longitude);
  }
  if (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    (lat !== 0 || lng !== 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  ) {
    return { lat, lng };
  }
  return null;
}

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.warn("Leaflet Map Error caught:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-[200px] w-full flex-col items-center justify-center rounded-xl border border-base-300 bg-base-200/50 p-4 text-center">
          <MapPin className="size-6 text-base-content/40 mb-1" />
          <p className="text-xs text-base-content/60">Map preview unavailable</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function MapViewUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position && Number.isFinite(position.lat) && Number.isFinite(position.lng)) {
      try {
        map.setView([position.lat, position.lng], 13, { animate: true });
      } catch {
        // Ignore map animation error
      }
    }
  }, [position, map]);
  return null;
}

function LocationMarker({ position, setPosition, onLocationSelect }) {
  useMapEvents({
    click(e) {
      const latlng = { lat: e.latlng.lat, lng: e.latlng.lng };
      setPosition(latlng);
      if (onLocationSelect) {
        onLocationSelect(latlng);
      }
    },
  });

  if (!position || typeof position.lat !== "number" || typeof position.lng !== "number") {
    return null;
  }

  return <Marker position={[position.lat, position.lng]} />;
}

export default function LocationPicker({ onLocationChange, initialPosition }) {
  const instanceId = useId();
  const [position, setPosition] = useState(() => normalizePos(initialPosition));
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");

  useEffect(() => {
    const next = normalizePos(initialPosition);
    if (next) {
      setPosition(next);
    }
  }, [initialPosition]);

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const coords = await getCurrentLocation();
      const latlng = { lat: coords.latitude, lng: coords.longitude };
      setPosition(latlng);
      
      let addressDetails = {
        formattedAddress: `Current Location (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`,
        city: "",
      };
      try {
        const res = await reverseGeocode(coords.latitude, coords.longitude);
        if (res) addressDetails = res;
      } catch {
        // Fallback to coordinates if reverse geocode fails
      }
      setAddress(addressDetails.formattedAddress || "");
      
      if (onLocationChange) {
        onLocationChange({
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...addressDetails,
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
      alert("Failed to get your location. Please click on the map or pick a preset.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = async (latlng) => {
    let addressDetails = {
      formattedAddress: `Selected Pin (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
      city: "",
      locality: "",
    };
    try {
      const res = await reverseGeocode(latlng.lat, latlng.lng);
      if (res) addressDetails = res;
    } catch (error) {
      console.warn("Reverse geocode fallback:", error);
    }
    setAddress(addressDetails.formattedAddress || "");
    
    if (onLocationChange) {
      onLocationChange({
        latitude: latlng.lat,
        longitude: latlng.lng,
        ...addressDetails,
      });
    }
  };

  const centerCoords = position
    ? [position.lat, position.lng]
    : [20.5937, 78.9629]; // Default India center

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={loading}
          className="btn btn-sm border border-base-300 bg-base-100 text-base-content hover:bg-base-200 disabled:opacity-50"
        >
          <Navigation className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Getting location..." : "Use my current location"}
        </button>
      </div>

      <div className="relative h-[300px] w-full rounded-xl border border-base-300 overflow-hidden">
        <MapErrorBoundary>
          <MapContainer
            key={`map-${instanceId}`}
            center={centerCoords}
            zoom={position ? 13 : 5}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapViewUpdater position={position} />
            <LocationMarker
              position={position}
              setPosition={setPosition}
              onLocationSelect={handleMapClick}
            />
          </MapContainer>
        </MapErrorBoundary>
      </div>

      {address && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-base-200 border border-base-300">
          <MapPin className="size-4 text-base-content/60 mt-0.5 shrink-0" />
          <p className="text-sm text-base-content">{address}</p>
        </div>
      )}

      {position && typeof position.lat === "number" && typeof position.lng === "number" && (
        <div className="text-xs text-base-content/60">
          Selected: {position.lat.toFixed(4)}, {position.lng.toFixed(4)}
        </div>
      )}
    </div>
  );
}
