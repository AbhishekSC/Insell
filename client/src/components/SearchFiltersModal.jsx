import { useState } from "react";
import { X, SlidersHorizontal } from "lucide-react";

const PROPERTY_TYPES = [
  "Apartment",
  "Villa",
  "Plot",
  "Commercial",
  "Office Space",
  "Shop",
  "Warehouse",
  "PG",
  "Hostel",
  "Studio"
];

const AMENITIES = [
  "Parking",
  "Gym",
  "Swimming Pool",
  "Security",
  "Power Backup",
  "Water Supply",
  "Lift",
  "Garden",
  "Club House",
  "Play Area",
  "AC",
  "Furnished",
  "Semi-Furnished",
  "Unfurnished"
];

export default function SearchFiltersModal({ isOpen, onClose, onApplyFilters, currentFilters }) {
  const [priceRange, setPriceRange] = useState({
    min: currentFilters?.priceMin || "",
    max: currentFilters?.priceMax || ""
  });
  const [selectedTypes, setSelectedTypes] = useState(currentFilters?.propertyTypes || []);
  const [selectedAmenities, setSelectedAmenities] = useState(currentFilters?.amenities || []);

  if (!isOpen) return null;

  const handleTypeToggle = (type) => {
    setSelectedTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleAmenityToggle = (amenity) => {
    setSelectedAmenities(prev =>
      prev.includes(amenity)
        ? prev.filter(a => a !== amenity)
        : [...prev, amenity]
    );
  };

  const handleApply = () => {
    onApplyFilters({
      priceMin: priceRange.min ? Number(priceRange.min) : undefined,
      priceMax: priceRange.max ? Number(priceRange.max) : undefined,
      propertyTypes: selectedTypes,
      amenities: selectedAmenities
    });
    onClose();
  };

  const handleClear = () => {
    setPriceRange({ min: "", max: "" });
    setSelectedTypes([]);
    setSelectedAmenities([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-base-100 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-base-content">Search Filters</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Price Range */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-base-content mb-3">Price Range</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-base-content/60 mb-1">Min Price</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-base-content/60 mb-1">Max Price</label>
                <input
                  type="number"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  className="w-full px-3 py-2 border border-base-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary text-sm"
                />
              </div>
            </div>
          </div>

          {/* Property Types */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-base-content mb-3">Property Type</h3>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeToggle(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedTypes.includes(type)
                      ? "bg-primary text-white"
                      : "bg-base-200 text-base-content hover:bg-base-300"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Amenities */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-base-content mb-3">Amenities</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AMENITIES.map(amenity => (
                <label key={amenity} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedAmenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    className="w-4 h-4 text-primary border-base-300 rounded focus:ring-primary"
                  />
                  <span className="text-xs text-base-content">{amenity}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 border-t border-base-300 bg-base-200">
          <button
            type="button"
            onClick={handleClear}
            className="text-sm text-base-content/70 hover:text-base-content font-medium"
          >
            Clear All
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-base-300 text-base-content hover:bg-base-200 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary text-sm font-medium"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
