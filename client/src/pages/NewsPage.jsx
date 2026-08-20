import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  ChevronDown,
  ExternalLink,
  Info,
  MapPin,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Building2,
} from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import { getAutoDetectedCity } from "../utils/geolocation";

const POPULAR_CITIES = [
  { id: "all", label: "All India" },
  { id: "Mumbai", label: "Mumbai" },
  { id: "Delhi", label: "Delhi NCR" },
  { id: "Bengaluru", label: "Bengaluru" },
  { id: "Pune", label: "Pune" },
  { id: "Hyderabad", label: "Hyderabad" },
  { id: "Noida", label: "Noida" },
  { id: "Indore", label: "Indore" },
  { id: "Gurgaon", label: "Gurgaon" },
  { id: "Chennai", label: "Chennai" },
  { id: "Ahmedabad", label: "Ahmedabad" },
];

const NEWS_CATEGORIES = [
  { id: "all", label: "All Topics" },
  { id: "real-estate", label: "Real Estate" },
  { id: "housing", label: "Housing & Flats" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "construction", label: "Development & Projects" },
  { id: "investment", label: "Investment & Prices" },
];

// Analyze news content and generate relevant badges
const analyzeNewsBadges = (title, description) => {
  const content = `${title} ${description || ""}`.toLowerCase();
  const badges = [];

  if (content.includes("housing") || content.includes("flat") || content.includes("apartment") || content.includes("residential") || content.includes("rent")) {
    badges.push("Housing");
  }

  if (content.includes("price") || content.includes("cost") || content.includes("rate") || content.includes("value") || content.includes("yield")) {
    badges.push("Pricing");
  }

  if (content.includes("investment") || content.includes("invest") || content.includes("fund") || content.includes("crore") || content.includes("reit")) {
    badges.push("Investment");
  }

  if (content.includes("policy") || content.includes("government") || content.includes("regulation") || content.includes("law") || content.includes("rera") || content.includes("guidelines")) {
    badges.push("Policy & RERA");
  }

  if (content.includes("metro") || content.includes("expressway") || content.includes("airport") || content.includes("highway") || content.includes("infrastructure")) {
    badges.push("Infrastructure");
  }

  if (content.includes("construction") || content.includes("builder") || content.includes("redevelopment") || content.includes("luxury")) {
    badges.push("Development");
  }

  if (badges.length === 0) {
    badges.push("Real Estate");
  }

  return badges.slice(0, 2);
};

const formatNewsDate = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
};

export default function NewsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current logged-in user to detect primary city
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;
  const userCity = authUser?.city || authUser?.locationDetails?.city || "";

  // Query params or state
  const initialCategory = searchParams.get("category") || "all";
  const initialCity = searchParams.get("city") || userCity || "all";

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [searchInput, setSearchInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);

  const cityDropdownRef = useRef(null);
  const categoryDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target)) {
        setIsCityDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Automatically detect user location if no city is explicitly passed in URL or profile
  useEffect(() => {
    const hasExplicitCity = searchParams.get("city");
    if (!hasExplicitCity && (!userCity || userCity === "all")) {
      getAutoDetectedCity().then((detected) => {
        if (detected) {
          setSelectedCity(detected);
        }
      });
    }
  }, [userCity, searchParams]);

  const { data: newsResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["trendingNews", selectedCategory, selectedCity],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory && selectedCategory !== "all") {
        params.append("category", selectedCategory);
      }
      if (selectedCity && selectedCity !== "all") {
        params.append("city", selectedCity);
      }

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const response = await axiosInstance.get(`/news/trending${queryString}`);
      return response.data;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const newsArticles = newsResponse?.data || [];
  const isFallback = Boolean(newsResponse?.isFallback);

  const handleCitySelect = (city) => {
    setSelectedCity(city);
    setIsCityDropdownOpen(false);
    const newParams = new URLSearchParams(searchParams);
    if (city === "all") {
      newParams.delete("city");
    } else {
      newParams.set("city", city);
    }
    setSearchParams(newParams);
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setIsCategoryDropdownOpen(false);
    const newParams = new URLSearchParams(searchParams);
    if (categoryId === "all") {
      newParams.delete("category");
    } else {
      newParams.set("category", categoryId);
    }
    setSearchParams(newParams);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (trimmed) {
      handleCitySelect(trimmed);
      setSearchInput("");
    }
  };

  const handleResetFilters = () => {
    setSelectedCity("all");
    setSelectedCategory("all");
    setSearchInput("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("city");
    newParams.delete("category");
    setSearchParams(newParams);
  };

  const handleDetectLocation = async () => {
    setIsLocating(true);
    try {
      const detected = await getAutoDetectedCity();
      if (detected) {
        handleCitySelect(detected);
      } else if (userCity) {
        handleCitySelect(userCity);
      }
    } catch {
      if (userCity) {
        handleCitySelect(userCity);
      }
    } finally {
      setIsLocating(false);
    }
  };

  // Label for current city dropdown button
  const currentCityLabel =
    POPULAR_CITIES.find((c) => c.id.toLowerCase() === selectedCity.toLowerCase())?.label ||
    (selectedCity === "all" ? "All India" : selectedCity);

  // Label for current category dropdown button
  const currentCategoryLabel =
    NEWS_CATEGORIES.find((c) => c.id === selectedCategory)?.label || "All Topics";

  return (
    <AppShell hideHero title="Property News" subtitle="Market trends, infrastructure updates, and housing policy in one place.">
      <div className="mx-auto max-w-7xl px-4 py-8 pb-24">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Property News
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Market trends, infrastructure updates, and housing policy in one place.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isLocating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
            >
              <MapPin className={`size-4 text-slate-600 ${isLocating ? "animate-spin text-indigo-600" : ""}`} />
              {isLocating ? "Locating..." : "Near Me"}
            </button>
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`size-4 text-slate-600 ${isFetching ? "animate-spin text-indigo-600" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {/* City Dropdown */}
            <div className="relative" ref={cityDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsCityDropdownOpen((prev) => !prev);
                  setIsCategoryDropdownOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none md:w-auto md:min-w-[130px]"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <MapPin className="size-4 text-slate-500" />
                  {currentCityLabel}
                </span>
                <ChevronDown className="size-4 text-slate-400" />
              </button>

              {isCityDropdownOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {POPULAR_CITIES.map((city) => (
                    <button
                      key={city.id}
                      type="button"
                      onClick={() => handleCitySelect(city.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                        selectedCity.toLowerCase() === city.id.toLowerCase()
                          ? "bg-indigo-50 font-semibold text-indigo-600"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      <MapPin className="size-3.5 text-slate-400" />
                      {city.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="relative" ref={categoryDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setIsCategoryDropdownOpen((prev) => !prev);
                  setIsCityDropdownOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus:outline-none md:w-auto md:min-w-[135px]"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <SlidersHorizontal className="size-4 text-slate-500" />
                  {currentCategoryLabel}
                </span>
                <ChevronDown className="size-4 text-slate-400" />
              </button>

              {isCategoryDropdownOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 max-h-60 w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {NEWS_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => handleCategorySelect(cat.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                        selectedCategory === cat.id
                          ? "bg-indigo-50 font-semibold text-indigo-600"
                          : "text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search Any City/Region Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex-1">
              <input
                type="text"
                placeholder="Search any city or region..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </form>

            {/* Reset Filters Link */}
            {(selectedCity !== "all" || selectedCategory !== "all") && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="shrink-0 text-xs font-medium text-indigo-600 hover:underline px-1"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* Fallback Notice Banner */}
        {isFallback && selectedCity && selectedCity !== "all" && !isLoading && (
          <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-xs text-slate-700">
            <Info className="size-4 shrink-0 text-blue-500" />
            <span>
              Direct live articles for <strong>{selectedCity}</strong> are currently limited — showing the latest national and metropolitan real estate updates.
            </span>
          </div>
        )}

        {/* News Grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="w-full h-52 bg-slate-200 animate-pulse" />
                <div className="p-5 space-y-3">
                  <div className="flex justify-between">
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-24" />
                    <div className="h-3 bg-slate-200 rounded animate-pulse w-12" />
                  </div>
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-800">Failed to load news updates</p>
            <p className="mt-2 text-sm text-slate-500">Please try again in a few moments</p>
            <button
              type="button"
              className="btn btn-sm mt-4 border-none bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        ) : newsArticles.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Building2 className="mx-auto size-12 text-slate-300 mb-3" />
            <p className="text-lg font-semibold text-slate-800">No news found for this selection</p>
            <p className="mt-2 text-sm text-slate-500">Try selecting "All India" or a different category</p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-sm mt-4 border-none bg-indigo-600 text-white hover:bg-indigo-500"
            >
              View All India News
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newsArticles.map((news) => {
              const badges = analyzeNewsBadges(news.title, news.description);
              const displayCity = news.city && news.city !== "National" ? news.city : (selectedCity !== "all" ? selectedCity : "");

              return (
                <a
                  key={news.id || news.url}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="relative overflow-hidden aspect-[16/10] bg-slate-100">
                    <img
                      src={news.image}
                      alt={news.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Top Left: City Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {displayCity && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                          <MapPin className="size-2.5 text-white" />
                          {displayCity}
                        </span>
                      )}
                    </div>

                    {/* Top Right: Category Badges */}
                    <div className="absolute top-3 right-3 flex flex-wrap gap-1.5">
                      {badges.map((badge, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded-full bg-indigo-600/90 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur shadow-sm"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    {/* Source & Date Row */}
                    <div className="mb-2.5 flex items-center justify-between text-xs">
                      <span className="font-semibold text-indigo-600">
                        {news.source?.name || news.source || "Real Estate News"}
                      </span>
                      {news.publishedAt && (
                        <span className="text-slate-400">
                          {formatNewsDate(news.publishedAt)}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="mb-2 text-base font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-indigo-600 transition">
                      {news.title}
                    </h3>

                    {/* Description */}
                    {news.description && (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                        {news.description}
                      </p>
                    )}

                    {/* Read Full Article */}
                    <div className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-indigo-600 group-hover:underline">
                      Read full article
                      <ExternalLink className="size-3.5" />
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
