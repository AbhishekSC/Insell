import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapPin, Bed, Bath, Square, Heart, Eye, IndianRupee, Building2, Calendar, Home, Sparkles, Trophy, SlidersHorizontal } from "lucide-react";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import axiosInstance from "../lib/axios";
import ComparisonHeader from "../components/comparison/ComparisonHeader";
import PropertyComparisonCard from "../components/comparison/PropertyComparisonCard";
import ComparisonTable from "../components/comparison/ComparisonTable";
import LoadingSkeleton from "../components/comparison/LoadingSkeleton";
import EmptyComparisonState from "../components/comparison/EmptyComparisonState";
import RecommendationCard from "../components/comparison/RecommendationCard";

export default function PropertyComparisonPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [hasAttemptedFetch, setHasAttemptedFetch] = useState(false);
  const [preferenceCriteria, setPreferenceCriteria] = useState('balanced');
  const [showPreferences, setShowPreferences] = useState(false);

  const propertyIds = searchParams.get('ids')?.split(',').filter(Boolean) || [];

  const { data, isLoading, error } = useQuery({
    queryKey: ["compareProperties", propertyIds, preferenceCriteria],
    queryFn: async () => {
      const response = await axiosInstance.post("/posts/compare", { 
        propertyIds,
        preferenceCriteria 
      });
      return response.data;
    },
    enabled: propertyIds.length >= 2 && propertyIds.length <= 4,
    retry: 1,
  });

  const properties = data?.data?.properties || [];
  const bestProperty = data?.data?.bestProperty || null;

  const criteriaOptions = [
    { value: 'balanced', label: 'Balanced', description: 'Considers all factors equally' },
    { value: 'price', label: 'Best Value', description: 'Prioritizes price and value for money' },
    { value: 'area', label: 'Largest Area', description: 'Prioritizes space and size' },
    { value: 'amenities', label: 'Best Amenities', description: 'Prioritizes features and facilities' },
    { value: 'location', label: 'Best Location', description: 'Prioritizes location quality' },
    { value: 'popularity', label: 'Most Popular', description: 'Prioritizes engagement and views' },
  ];

  useEffect(() => {
    if (propertyIds.length < 2) {
      toast.error("Please select at least 2 properties to compare");
      navigate("/marketplace");
      return;
    }

    if (propertyIds.length > 4) {
      toast.error("Maximum 4 properties can be compared at once");
      navigate("/marketplace");
      return;
    }

    setHasAttemptedFetch(true);
  }, [propertyIds]);

  useEffect(() => {
    if (error && hasAttemptedFetch) {
      toast.error(error?.response?.data?.message || "Failed to load properties for comparison");
      navigate("/marketplace");
    }
  }, [error, hasAttemptedFetch]);

  const formatPrice = (price) => {
    if (!price) return "N/A";
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (properties.length === 0) {
    return <EmptyComparisonState />;
  }

  const comparisonItems = [
    { key: 'price', label: 'Price', icon: IndianRupee, format: formatPrice, highlight: true, best: 'min' },
    { key: 'areaSqft', label: 'Area', icon: Square, suffix: 'sq ft', highlight: true, best: 'max' },
    { key: 'bedrooms', label: 'Bedrooms', icon: Bed, highlight: true, best: 'max' },
    { key: 'bathrooms', label: 'Bathrooms', icon: Bath, highlight: true, best: 'max' },
    { key: 'propertyType', label: 'Property Type', icon: Building2 },
    { key: 'listingType', label: 'Listing Type' },
    { key: 'city', label: 'City', icon: MapPin },
    { key: 'locality', label: 'Locality', icon: MapPin },
    { key: 'furnished', label: 'Furnished' },
    { key: 'parking', label: 'Parking' },
    { key: 'facing', label: 'Facing' },
    { key: 'floorNumber', label: 'Floor', customFormat: (val, prop) => val && prop.totalFloors ? `${val} of ${prop.totalFloors}` : val || 'N/A' },
    { key: 'ageOfProperty', label: 'Property Age', suffix: 'years' },
    { key: 'possessionStatus', label: 'Possession' },
    { key: 'viewCount', label: 'Views', icon: Eye },
    { key: 'likesCount', label: 'Likes', icon: Heart },
    { key: 'savesCount', label: 'Saves', icon: Heart },
    { key: 'commentCount', label: 'Comments' },
    { key: 'shareCount', label: 'Shares' },
    { key: 'publishedAt', label: 'Published', icon: Calendar, format: formatDate },
  ];

  const getBestValue = (key, bestType) => {
    const values = properties.map(p => p[key]).filter(v => v !== undefined && v !== null);
    if (values.length === 0) return null;
    return bestType === 'min' ? Math.min(...values) : Math.max(...values);
  };

  return (
    <div className="min-h-screen bg-base-200">
      <ComparisonHeader propertyCount={properties.length} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Best Property Banner */}
        {bestProperty && (
          <div className="mb-8 bg-gradient-to-r from-warning to-warning border border-warning/30 rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="bg-warning text-white p-2 rounded-full">
                  <Trophy className="size-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-warning">Best Property Choice</h2>
                  <p className="text-sm text-warning">{bestProperty.reason}</p>
                </div>
              </div>
              <button
                onClick={() => setShowPreferences(!showPreferences)}
                className="flex items-center gap-2 px-3 py-2 bg-base-100 rounded-lg border border-warning/30 hover:bg-warning/10 transition-colors"
              >
                <SlidersHorizontal className="size-4 text-warning" />
                <span className="text-sm font-medium text-warning">Customize</span>
              </button>
            </div>

            {/* Preference Selector */}
            {showPreferences && (
              <div className="bg-base-100 rounded-xl p-4 border border-warning/30 mb-4">
                <h3 className="font-semibold text-base-content mb-3">Choose your priority</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {criteriaOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPreferenceCriteria(option.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        preferenceCriteria === option.value
                          ? 'border-primary bg-primary/10'
                          : 'border-base-300 hover:border-base-300'
                      }`}
                    >
                      <div className="font-medium text-base-content text-sm">{option.label}</div>
                      <div className="text-xs text-base-content/60 mt-1">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-base-100 rounded-xl p-4 border border-warning/30">
              <p className="font-semibold text-base-content">{bestProperty.title}</p>
              <p className="text-sm text-base-content/70 mt-1">
                Based on {criteriaOptions.find(c => c.value === preferenceCriteria)?.label.toLowerCase() || 'balanced'} criteria
              </p>
            </div>
          </div>
        )}

        {/* Property Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {properties.map((property) => (
            <PropertyComparisonCard
              key={property.id}
              property={property}
              formatPrice={formatPrice}
              isBest={property.isBest || false}
            />
          ))}
        </div>

        {/* Comparison Table */}
        <ComparisonTable
          properties={properties}
          comparisonItems={comparisonItems}
          getBestValue={getBestValue}
        />
      </div>
    </div>
  );
}
