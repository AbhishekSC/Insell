import { useState } from "react";
import { Filter, X, SlidersHorizontal, Home, Building2, MapPin, IndianRupee, Calendar, Users, Bed, Bath, Maximize, ChevronDown, TrendingUp } from "lucide-react";

const ROLE_FILTER_CONFIGS = {
  Tenant: {
    filters: [
      { key: "budgetRange", label: "Budget Range", type: "range", icon: IndianRupee, min: 5000, max: 200000, step: 5000 },
      { key: "furnishing", label: "Furnishing", type: "select", icon: Home, options: ["Any", "Furnished", "Semi-Furnished", "Unfurnished"] },
      { key: "moveInDate", label: "Move-in Date", type: "date", icon: Calendar },
      { key: "occupancy", label: "Occupancy", type: "select", icon: Users, options: ["Any", "Family", "Bachelors", "Students"] },
      { key: "bedrooms", label: "Bedrooms", type: "select", icon: Bed, options: ["Any", "1 RK", "1 BHK", "2 BHK", "3 BHK", "4+ BHK"] },
      { key: "propertyType", label: "Property Type", type: "select", icon: Building2, options: ["Any", "Apartment", "Independent House", "PG/Hostel", "Co-living"] },
    ],
    defaults: {
      budgetRange: [5000, 50000],
      furnishing: "Any",
      occupancy: "Any",
      bedrooms: "Any",
      propertyType: "Any"
    }
  },
  Buyer: {
    filters: [
      { key: "budgetRange", label: "Budget Range", type: "range", icon: IndianRupee, min: 1000000, max: 100000000, step: 1000000 },
      { key: "propertyType", label: "Property Type", type: "select", icon: Building2, options: ["Any", "Apartment", "Independent House", "Villa", "Plot", "Commercial"] },
      { key: "bedrooms", label: "Bedrooms", type: "select", icon: Bed, options: ["Any", "1 BHK", "2 BHK", "3 BHK", "4 BHK", "5+ BHK"] },
      { key: "areaRange", label: "Area (sqft)", type: "range", icon: Maximize, min: 500, max: 10000, step: 100 },
      { key: "possessionStatus", label: "Possession", type: "select", icon: Calendar, options: ["Any", "Ready to Move", "Under Construction", "New Launch"] },
      { key: "reraVerified", label: "RERA Verified", type: "toggle", icon: Home },
    ],
    defaults: {
      budgetRange: [2000000, 15000000],
      propertyType: "Any",
      bedrooms: "Any",
      areaRange: [500, 3000],
      possessionStatus: "Any",
      reraVerified: false
    }
  },
  Seller: {
    filters: [
      { key: "listingType", label: "Listing Type", type: "select", icon: Home, options: ["All", "Sale", "Rent"] },
      { key: "propertyType", label: "Property Type", type: "select", icon: Building2, options: ["All", "Apartment", "House", "Villa", "Plot", "Commercial"] },
      { key: "priceRange", label: "Price Range", type: "range", icon: IndianRupee, min: 1000000, max: 100000000, step: 1000000 },
      { key: "postedDate", label: "Posted Date", type: "date", icon: Calendar },
      { key: "engagementMin", label: "Min Engagement Score", type: "range", icon: Users, min: 0, max: 100, step: 5 },
    ],
    defaults: {
      listingType: "All",
      propertyType: "All",
      priceRange: [1000000, 50000000],
      postedDate: "",
      engagementMin: 0
    }
  },
  Broker: {
    filters: [
      { key: "leadQuality", label: "Lead Quality", type: "select", icon: Users, options: ["All", "High Intent", "Medium", "Low"] },
      { key: "budgetRange", label: "Budget Range", type: "range", icon: IndianRupee, min: 1000000, max: 100000000, step: 1000000 },
      { key: "propertyType", label: "Property Type", type: "select", icon: Building2, options: ["All", "Apartment", "House", "Commercial", "Land"] },
      { key: "location", label: "Location", type: "text", icon: MapPin },
      { key: "urgentOnly", label: "Urgent Only", type: "toggle", icon: Calendar },
      { key: "verifiedClients", label: "Verified Clients Only", type: "toggle", icon: Home },
    ],
    defaults: {
      leadQuality: "All",
      budgetRange: [2000000, 20000000],
      propertyType: "All",
      location: "",
      urgentOnly: false,
      verifiedClients: false
    }
  },
  Builder: {
    filters: [
      { key: "projectStatus", label: "Project Status", type: "select", icon: Building2, options: ["All", "New Launch", "Under Construction", "Ready to Move", "Completed"] },
      { key: "priceRange", label: "Price Range", type: "range", icon: IndianRupee, min: 1000000, max: 100000000, step: 1000000 },
      { key: "reraRegistered", label: "RERA Registered", type: "toggle", icon: Home },
      { key: "inventoryType", label: "Inventory Type", type: "select", icon: Maximize, options: ["All", "Apartments", "Villas", "Plots", "Commercial"] },
      { key: "launchYear", label: "Launch Year", type: "select", icon: Calendar, options: ["All", "2024", "2023", "2022", "2021", "Older"] },
    ],
    defaults: {
      projectStatus: "All",
      priceRange: [3000000, 30000000],
      reraRegistered: false,
      inventoryType: "All",
      launchYear: "All"
    }
  },
  Investor: {
    filters: [
      { key: "investmentType", label: "Investment Type", type: "select", icon: Building2, options: ["All", "Residential", "Commercial", "Land", "REITs"] },
      { key: "roiRange", label: "Expected ROI (%)", type: "range", icon: IndianRupee, min: 5, max: 25, step: 1 },
      { key: "budgetRange", label: "Investment Range", type: "range", icon: IndianRupee, min: 1000000, max: 100000000, step: 1000000 },
      { key: "timeHorizon", label: "Time Horizon", type: "select", icon: Calendar, options: ["Any", "Short-term (1-3 yrs)", "Medium-term (3-7 yrs)", "Long-term (7+ yrs)"] },
      { key: "location", label: "Location", type: "text", icon: MapPin },
      { key: "highGrowthAreas", label: "High Growth Areas Only", type: "toggle", icon: TrendingUp },
    ],
    defaults: {
      investmentType: "All",
      roiRange: [8, 15],
      budgetRange: [5000000, 50000000],
      timeHorizon: "Any",
      location: "",
      highGrowthAreas: false
    }
  }
};

export default function RoleBasedFilters({ userRole, isOpen, onClose, onApply, onReset }) {
  const role = userRole || "Buyer";
  const config = ROLE_FILTER_CONFIGS[role] || ROLE_FILTER_CONFIGS.Buyer;
  const [activeFilters, setActiveFilters] = useState(config.defaults);

  const handleFilterChange = (key, value) => {
    setActiveFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    // The feed only reads a fixed shape (transactionType/propertyType/city/
    // locality/budgetMin/budgetMax) — translate whichever role-specific
    // fields are present into that shape so "Apply" actually narrows results
    // instead of being silently ignored.
    const budgetSource = activeFilters.budgetRange || activeFilters.priceRange || null;
    const rawPropertyType = activeFilters.propertyType;
    onApply?.({
      transactionType: "All",
      propertyType: rawPropertyType && !["All", "Any"].includes(rawPropertyType) ? rawPropertyType : "All",
      city: "",
      locality: activeFilters.location || "",
      budgetMin: budgetSource ? budgetSource[0] : 0,
      budgetMax: budgetSource ? budgetSource[1] : 0,
    });
    onClose?.();
  };

  const handleReset = () => {
    setActiveFilters(config.defaults);
    onReset?.();
  };

  const renderFilterInput = (filter) => {
    const Icon = filter.icon;

    switch (filter.type) {
      case "select":
        return (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icon className="size-4 text-base-content/50" />
            </div>
            <select
              className="select select-bordered w-full border-base-300 bg-base-200 pl-10 focus:border-primary/30"
              value={activeFilters[filter.key] || filter.options[0]}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            >
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      case "range":
        return (
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-base-content/70">
                {formatMoney(activeFilters[filter.key]?.[0] || filter.min)}
              </span>
              <span className="text-base-content/70">
                {formatMoney(activeFilters[filter.key]?.[1] || filter.max)}
              </span>
            </div>
            <input
              type="range"
              min={filter.min}
              max={filter.max}
              step={filter.step}
              value={activeFilters[filter.key]?.[1] || filter.max}
              onChange={(e) => {
                const current = activeFilters[filter.key] || [filter.min, filter.max];
                handleFilterChange(filter.key, [current[0], Number(e.target.value)]);
              }}
              className="range range-xs range-primary"
            />
          </div>
        );

      case "text":
        return (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icon className="size-4 text-base-content/50" />
            </div>
            <input
              type="text"
              className="input input-bordered w-full border-base-300 bg-base-200 pl-10 focus:border-primary/30"
              placeholder={`Search ${filter.label.toLowerCase()}...`}
              value={activeFilters[filter.key] || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            />
          </div>
        );

      case "date":
        return (
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Icon className="size-4 text-base-content/50" />
            </div>
            <input
              type="date"
              className="input input-bordered w-full border-base-300 bg-base-200 pl-10 focus:border-primary/30"
              value={activeFilters[filter.key] || ""}
              onChange={(e) => handleFilterChange(filter.key, e.target.value)}
            />
          </div>
        );

      case "toggle":
        return (
          <label className="flex cursor-pointer items-center justify-between">
            <span className="text-sm font-medium text-base-content">{filter.label}</span>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={activeFilters[filter.key] || false}
              onChange={(e) => handleFilterChange(filter.key, e.target.checked)}
            />
          </label>
        );

      default:
        return null;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-base-100 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-base-300 p-4">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-base-content">
              {role} Filters
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost btn-circle"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Filter Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="space-y-4">
            {config.filters.map((filter) => (
              <div key={filter.key} className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-base-content">
                  <filter.icon className="size-4 text-primary" />
                  {filter.label}
                </label>
                {renderFilterInput(filter)}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-base-300 p-4">
          <button
            type="button"
            className="btn btn-sm border-base-300 bg-base-100 text-base-content hover:bg-base-200"
            onClick={handleReset}
          >
            Reset
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-sm border-base-300 bg-base-100 text-base-content hover:bg-base-200"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm bg-primary text-white hover:bg-primary"
              onClick={handleApply}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
