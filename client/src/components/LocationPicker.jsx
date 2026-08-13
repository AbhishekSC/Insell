import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
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

function LocationMarker({ position, setPosition, onLocationSelect }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
      if (onLocationSelect) {
        onLocationSelect(e.latlng);
      }
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

export default function LocationPicker({ onLocationChange, initialPosition }) {
  const [position, setPosition] = useState(initialPosition || null);
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState("");

  const handleGetCurrentLocation = async () => {
    setLoading(true);
    try {
      const coords = await getCurrentLocation();
      const latlng = { lat: coords.latitude, lng: coords.longitude };
      setPosition(latlng);
      
      // Get address details
      const addressDetails = await reverseGeocode(coords.latitude, coords.longitude);
      setAddress(addressDetails.formattedAddress);
      
      if (onLocationChange) {
        onLocationChange({
          latitude: coords.latitude,
          longitude: coords.longitude,
          ...addressDetails,
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
      alert("Failed to get your location. Please make sure location services are enabled.");
    } finally {
      setLoading(false);
    }
  };

  const handleMapClick = async (latlng) => {
    try {
      const addressDetails = await reverseGeocode(latlng.lat, latlng.lng);
      setAddress(addressDetails.formattedAddress);
      
      if (onLocationChange) {
        onLocationChange({
          latitude: latlng.lat,
          longitude: latlng.lng,
          ...addressDetails,
        });
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={loading}
          className="btn btn-sm border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Navigation className={`size-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Getting location..." : "Use my current location"}
        </button>
      </div>

      <div className="relative h-[300px] w-full rounded-xl border border-slate-200 overflow-hidden">
        <MapContainer
          center={position || [20.5937, 78.9629]} // Default to India center
          zoom={position ? 13 : 5}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LocationMarker
            position={position}
            setPosition={setPosition}
            onLocationSelect={handleMapClick}
          />
        </MapContainer>
      </div>

      {address && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <MapPin className="size-4 text-slate-500 mt-0.5 shrink-0" />
          <p className="text-sm text-slate-700">{address}</p>
        </div>
      )}

      {position && (
        <div className="text-xs text-slate-500">
          Selected: {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
}
