import { useQuery } from "@tanstack/react-query";
import { RefreshCw, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router";
import axiosInstance from "../lib/axios";

// Same trending news/localities content as the desktop marketplace sidebar
// (MarketplacePage.jsx), extracted so it can also be dropped into the mobile
// hamburger drawer — that aside is xl-only and otherwise invisible on phones.
const TRENDING_LOCALITIES = ["Indore - Super Corridor", "Bengaluru - Whitefield", "Pune - Hinjewadi", "Noida - Sector 150"];

export default function TrendingWidgets({ onNavigate }) {
  const navigate = useNavigate();

  const { data: newsData, isLoading: newsLoading, refetch: refetchNews } = useQuery({
    queryKey: ["trendingNews"],
    queryFn: async () => {
      const response = await axiosInstance.get("/news/trending");
      return response.data.data || [];
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const goToNews = () => {
    onNavigate?.();
    navigate("/news");
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Trending Localities</p>
          <TrendingUp className="size-4 text-slate-400" />
        </div>
        <div className="space-y-2">
          {TRENDING_LOCALITIES.map((item) => (
            <div key={item} className="rounded-xl border border-slate-200 p-2 text-xs font-medium text-slate-700">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-bold text-slate-800">Trending News</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-circle btn-sm text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
              onClick={() => refetchNews()}
              disabled={newsLoading}
              title="Refresh news"
            >
              <RefreshCw className={`size-4 ${newsLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              className="btn btn-xs border border-slate-200 bg-white text-indigo-600 hover:bg-indigo-50"
              onClick={goToNews}
            >
              View all
            </button>
          </div>
        </div>

        {newsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-slate-200">
                <div className="h-24 w-full animate-pulse bg-slate-200" />
                <div className="space-y-2 p-2">
                  <div className="h-3 animate-pulse rounded bg-slate-200" />
                  <div className="h-2 w-20 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {newsData?.slice(0, 3).map((news) => (
              <a
                key={news.id}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-lg border border-slate-200 transition hover:border-indigo-200 hover:shadow-sm"
              >
                <img src={news.image} alt={news.title} className="h-24 w-full object-cover" />
                <div className="p-2">
                  <p className="line-clamp-2 text-xs font-semibold text-slate-800">{news.title}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{news.source?.name || news.source || "Unknown"}</p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
