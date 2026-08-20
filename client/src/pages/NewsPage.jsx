import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import {
  Calendar,
  ExternalLink,
  Filter,
  MapPin,
  Search,
  Sparkles,
  RefreshCw,
  Building2,
  Navigation,
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
  { id: "infrastructure", label: "Metro & Infrastructure" },
  { id: "construction", label: "Development & Projects" },
  { id: "investment", label: "Investment & Prices" },
];

// Analyze news content and generate relevant badges
const analyzeNewsBadges = (title, description) => {
  const content = `${title} ${description || ""}`.toLowerCase();
  const badges = [];

  if (content.includes("price") || content.includes("cost") || content.includes("rate") || content.includes("value") || content.includes("yield")) {
    badges.push({ label: "Pricing", color: "bg-emerald-500/90" });
  }

  if (content.includes("policy") || content.includes("government") || content.includes("regulation") || content.includes("law") || content.includes("rera")) {
    badges.push({ label: "Policy & RERA", color: "bg-blue-500/90" });
  }

  if (content.includes("investment") || content.includes("invest") || content.includes("fund") || content.includes("crore") || content.includes("reit")) {
    badges.push({ label: "Investment", color: "bg-purple-500/90" });
  }

  if (content.includes("metro") || content.includes("expressway") || content.includes("airport") || content.includes("highway") || content.includes("road") || content.includes("corridor")) {
    badges.push({ label: "Infrastructure", color: "bg-amber-500/90" });
  }

  if (content.includes("construction") || content.includes("builder") || content.includes("redevelopment") || content.includes("luxury")) {
    badges.push({ label: "Development", color: "bg-orange-500/90" });
  }

  if (content.includes("housing") || content.includes("flat") || content.includes("apartment") || content.includes("residential") || content.includes("rent")) {
    badges.push({ label: "Housing", color: "bg-teal-500/90" });
  }

  if (badges.length === 0) {
    badges.push({ label: "Real Estate", color: "bg-indigo-500/90" });
  }

  return badges.slice(0, 2);
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
  const [customCityInput, setCustomCityInput] = useState("");
  const [isLocating, setIsLocating] = useState(false);

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
    const newParams = new URLSearchParams(searchParams);
    if (categoryId === "all") {
      newParams.delete("category");
    } else {
      newParams.set("category", categoryId);
    }
    setSearchParams(newParams);
  };

  const handleCustomCitySubmit = (e) => {
    e.preventDefault();
    const trimmed = customCityInput.trim();
    if (trimmed) {
      handleCitySelect(trimmed);
      setCustomCityInput("");
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.state_district ||
            data.address?.state;
          if (city) {
            handleCitySelect(city);
          }
        } catch {
          if (userCity) {
            handleCitySelect(userCity);
          }
        } finally {
          setIsLocating(false);
        }
      },
      () => {
        setIsLocating(false);
        if (userCity) {
          handleCitySelect(userCity);
        }
      }
    );
  };

  return (
    <AppShell hideHero title="Real Estate News" subtitle="Hyper-local & national property market insights">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24">
        {/* Top Header Card */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 text-white shadow-lg">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="size-6 text-indigo-200" />
                <h1 className="text-xl font-bold text-white sm:text-2xl">
                  {selectedCity && selectedCity !== "all" ? `${selectedCity} Property News` : "Real Estate & Housing News"}
                </h1>
              </div>
              <p className="mt-1 text-sm text-indigo-100">
                Filtered real estate market trends, infrastructure updates, and housing policies.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {userCity && selectedCity !== userCity && (
                <button
                  type="button"
                  onClick={() => handleCitySelect(userCity)}
                  className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/30 transition"
                >
                  <MapPin className="size-3.5 text-amber-300" />
                  My City ({userCity})
                </button>
              )}

              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isLocating}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/30 transition disabled:opacity-50"
              >
                <Navigation className={`size-3.5 ${isLocating ? "animate-spin" : ""}`} />
                {isLocating ? "Detecting..." : "Near Me"}
              </button>

              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/30 transition disabled:opacity-50"
                title="Refresh news"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* Custom City Search Input */}
          <form onSubmit={handleCustomCitySubmit} className="mt-4 flex max-w-md items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-indigo-200" />
              <input
                type="text"
                placeholder="Search any city or region (e.g. Jaipur, Lucknow, Thane)..."
                value={customCityInput}
                onChange={(e) => setCustomCityInput(e.target.value)}
                className="w-full rounded-xl border border-white/30 bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-indigo-200 backdrop-blur focus:bg-white focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-white"
              />
            </div>
            <button
              type="submit"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow"
            >
              Filter
            </button>
          </form>
        </div>

        {/* City Filter Pills */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
              <MapPin className="size-3.5 text-indigo-600" />
              Select Region / City
            </span>
            {selectedCity !== "all" && (
              <button
                type="button"
                onClick={() => handleCitySelect("all")}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Reset to All India
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {POPULAR_CITIES.map((city) => {
              const isActive = selectedCity.toLowerCase() === city.id.toLowerCase();
              return (
                <button
                  key={city.id}
                  type="button"
                  onClick={() => handleCitySelect(city.id)}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                  }`}
                >
                  {city.id !== "all" && <MapPin className={`size-3 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />}
                  {city.label}
                </button>
              );
            })}
            {/* If custom city is selected and not in popular list */}
            {selectedCity !== "all" &&
              !POPULAR_CITIES.some((c) => c.id.toLowerCase() === selectedCity.toLowerCase()) && (
                <button
                  type="button"
                  className="flex shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm"
                >
                  <MapPin className="size-3 text-indigo-400" />
                  {selectedCity}
                </button>
              )}
          </div>
        </div>

        {/* Category Topic Filters */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Filter className="size-4 shrink-0 text-slate-400" />
          {NEWS_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === category.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
              }`}
              onClick={() => handleCategorySelect(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* Notice if Fallback national news is shown */}
        {isFallback && selectedCity !== "all" && !isLoading && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <Sparkles className="size-4 shrink-0 text-amber-600" />
            <span>
              Direct live articles for <strong>{selectedCity}</strong> are currently limited. Showing latest national and metropolitan real estate market updates.
            </span>
          </div>
        )}

        {/* News Grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="w-full h-48 bg-slate-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-2/3" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-1/3" />
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
              onClick={() => {
                handleCitySelect("all");
                handleCategorySelect("all");
              }}
              className="btn btn-sm mt-4 border-none bg-indigo-600 text-white hover:bg-indigo-500"
            >
              View All India News
            </button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newsArticles.map((news) => {
              const badges = analyzeNewsBadges(news.title, news.description);
              return (
                <a
                  key={news.id || news.url}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-300 hover:shadow-xl transition-all duration-200"
                >
                  <div className="relative overflow-hidden aspect-[16/9] bg-slate-100">
                    <img
                      src={news.image}
                      alt={news.title}
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=600&q=80";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                      {news.city && news.city !== "National" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur">
                          <MapPin className="size-2.5 text-indigo-400" />
                          {news.city}
                        </span>
                      )}
                    </div>
                    <div className="absolute top-3 right-3 flex flex-wrap gap-1">
                      {badges.map((badge, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center rounded-full ${badge.color} px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur shadow-sm`}
                        >
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-indigo-600">
                        {news.source?.name || news.source || "Real Estate Pulse"}
                      </span>
                      {news.publishedAt && (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Calendar className="size-3" />
                          {new Date(news.publishedAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                    </div>

                    <h3 className="mb-2 text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition">
                      {news.title}
                    </h3>

                    {news.description && (
                      <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed mb-4">
                        {news.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center gap-1 pt-2 text-xs font-semibold text-indigo-600 group-hover:translate-x-1 transition-transform">
                      Read full article
                      <ExternalLink className="size-3" />
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
