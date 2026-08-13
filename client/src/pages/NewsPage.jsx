import { useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, ExternalLink, Filter } from "lucide-react";
import AppShell from "../components/AppShell";
import axiosInstance from "../lib/axios";
import toast from "react-hot-toast";

const NEWS_CATEGORIES = [
  { id: "all", label: "All News" },
  { id: "real-estate", label: "Real Estate" },
  { id: "housing", label: "Housing" },
  { id: "construction", label: "Construction" },
  { id: "infrastructure", label: "Infrastructure" },
  { id: "investment", label: "Investment" },
];

// Function to analyze news content and generate relevant badges
const analyzeNewsBadges = (title, description) => {
  const content = `${title} ${description || ""}`.toLowerCase();
  const badges = [];

  // Price/Market related
  if (content.includes("price") || content.includes("cost") || content.includes("rate") || content.includes("value")) {
    badges.push({ label: "Pricing", color: "bg-emerald-500/90" });
  }

  // Policy/Government related
  if (content.includes("policy") || content.includes("government") || content.includes("regulation") || content.includes("law") || content.includes("bill")) {
    badges.push({ label: "Policy", color: "bg-blue-500/90" });
  }

  // Investment related
  if (content.includes("investment") || content.includes("invest") || content.includes("fund") || content.includes("returns") || content.includes("reit")) {
    badges.push({ label: "Investment", color: "bg-purple-500/90" });
  }

  // Construction/Development related
  if (content.includes("construction") || content.includes("building") || content.includes("development") || content.includes("project")) {
    badges.push({ label: "Development", color: "bg-orange-500/90" });
  }

  // Housing/Apartment related
  if (content.includes("housing") || content.includes("apartment") || content.includes("home") || content.includes("residential") || content.includes("flat")) {
    badges.push({ label: "Housing", color: "bg-teal-500/90" });
  }

  // Infrastructure related
  if (content.includes("infrastructure") || content.includes("road") || content.includes("bridge") || content.includes("metro") || content.includes("highway")) {
    badges.push({ label: "Infrastructure", color: "bg-amber-500/90" });
  }

  // Market trends
  if (content.includes("market") || content.includes("trend") || content.includes("growth") || content.includes("decline") || content.includes("recovery")) {
    badges.push({ label: "Market", color: "bg-rose-500/90" });
  }

  // If no badges found, return a general badge
  if (badges.length === 0) {
    badges.push({ label: "News", color: "bg-slate-500/90" });
  }

  // Return max 2 badges
  return badges.slice(0, 2);
};

export default function NewsPage() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: newsData, isLoading, error, refetch } = useQuery({
    queryKey: ["trendingNews", selectedCategory],
    queryFn: async () => {
      const categoryParam = selectedCategory === "all" ? "" : `?category=${selectedCategory}`;
      const response = await axiosInstance.get(`/news/trending${categoryParam}`);
      console.log("News API response:", response.data);
      return response.data.data || [];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  return (
    <AppShell hideHero title="News" subtitle="Latest real estate updates">
      <div className="mx-auto max-w-7xl px-4 py-6 pb-24">
        {/* Category Filter */}
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-2">
          <Filter className="size-4 shrink-0 text-slate-500" />
          {NEWS_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`btn btn-sm rounded-full border-none whitespace-nowrap ${
                selectedCategory === category.id
                  ? "bg-indigo-600 text-white hover:bg-indigo-500"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>

        {/* News Grid */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="w-full h-48 bg-slate-200 animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-full" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-1/2" />
                  <div className="h-3 bg-slate-200 rounded animate-pulse w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-slate-800">Failed to load news</p>
            <p className="mt-2 text-sm text-slate-500">Please try again later</p>
            <button
              type="button"
              className="btn btn-sm mt-4 border-none bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => window.location.reload()}
            >
              Retry
            </button>
          </div>
        ) : newsData?.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-lg font-semibold text-slate-800">No news found</p>
            <p className="mt-2 text-sm text-slate-500">Try selecting a different category</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {newsData.map((news) => {
              const badges = analyzeNewsBadges(news.title, news.description);
              return (
                <a
                  key={news.id}
                  href={news.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-200 hover:shadow-lg transition-all duration-200"
                >
                  <div className="relative">
                    <img
                      src={news.image}
                      alt={news.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute top-3 right-3 flex gap-1">
                      {badges.map((badge, index) => (
                        <span key={index} className={`inline-flex items-center rounded-full ${badge.color} px-2 py-1 text-[10px] font-semibold text-white backdrop-blur`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-500">
                    <span className="font-semibold text-indigo-600">{news.source?.name || news.source || "Unknown"}</span>
                    {news.publishedAt && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3" />
                          {new Date(news.publishedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="mb-2 text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-indigo-600 transition">
                    {news.title}
                  </h3>
                  {news.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">{news.description}</p>
                  )}
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
