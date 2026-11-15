import { useState, useMemo } from "react";
import { Link } from "react-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Building2, Search, Star, UtensilsCrossed, Users, Bed, MapPin,
  Wifi, Filter, ChevronRight, Sparkles, TrendingUp, Shield,
} from "lucide-react";
import AppShell from "../components/AppShell";
import PropertyPostCard from "../components/PropertyPostCard";
import SEO from "../components/SEO";
import axiosInstance from "../lib/axios";

const GENDER_OPTIONS = ["All", "Boys", "Girls", "Unisex"];
const SHARING_OPTIONS = ["All", "Single", "Double", "Triple"];

export default function PgListingPage() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("All");
  const [foodOnly, setFoodOnly] = useState(false);
  const [sharing, setSharing] = useState("All");
  const [sortBy, setSortBy] = useState("recent");

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["pgListings"],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axiosInstance.get("/property-posts/feed", {
        params: { page: pageParam, limit: 30, category: "pg/hostel" },
      });
      return res.data?.data || res.data;
    },
    getNextPageParam: (last) => {
      const p = last?.pagination;
      return p?.page < p?.totalPages ? p.page + 1 : undefined;
    },
    staleTime: 5 * 60 * 1000,
  });

  const allPosts = useMemo(() => (data?.pages || []).flatMap((p) => p?.posts || []), [data]);

  const filtered = useMemo(() => {
    let list = allPosts;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) =>
        [p.title, p.locality, p.city, p.caption].some((f) => (f || "").toLowerCase().includes(q)) ||
        (p.postMeta?.pgHostel?.nearbyColleges || []).some((c) => c.toLowerCase().includes(q)) ||
        (p.postMeta?.pgHostel?.nearbyOffices || []).some((o) => o.toLowerCase().includes(q))
      );
    }
    if (gender !== "All") {
      list = list.filter((p) => {
        const g = p.postMeta?.pgHostel?.genderPreference;
        return g === gender.toLowerCase() || g === "unisex" || g === "any";
      });
    }
    if (foodOnly) {
      list = list.filter((p) => p.postMeta?.pgHostel?.foodIncluded === true);
    }
    if (sharing !== "All") {
      list = list.filter((p) =>
        (p.postMeta?.pgHostel?.sharingTypes || []).some((s) => (s.type || "").toLowerCase() === sharing.toLowerCase())
      );
    }
    if (sortBy === "price") {
      list = [...list].sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === "rating") {
      const avgRating = (pg) => {
        if (!pg?.avgRatings) return 0;
        const vals = Object.values(pg.avgRatings).filter((v) => typeof v === "number" && v > 0);
        return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : 0;
      };
      list = [...list].sort((a, b) => avgRating(b.postMeta?.pgHostel) - avgRating(a.postMeta?.pgHostel));
    }
    return list;
  }, [allPosts, search, gender, foodOnly, sharing, sortBy]);

  const topRated = useMemo(() => {
    return allPosts
      .filter((p) => {
        const pg = p.postMeta?.pgHostel;
        return pg?.reviewCount > 0;
      })
      .sort((a, b) => {
        const rA = a.postMeta?.pgHostel?.avgRatings?.overall || 0;
        const rB = b.postMeta?.pgHostel?.avgRatings?.overall || 0;
        return rB - rA;
      })
      .slice(0, 6);
  }, [allPosts]);

  const recentlyAdded = useMemo(() => {
    return [...allPosts]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 6);
  }, [allPosts]);

  const collegePgs = useMemo(() => {
    const map = {};
    allPosts.forEach((p) => {
      (p.postMeta?.pgHostel?.nearbyColleges || []).forEach((c) => {
        if (!map[c]) map[c] = [];
        if (map[c].length < 4) map[c].push(p);
      });
    });
    return Object.entries(map)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 3);
  }, [allPosts]);

  return (
    <AppShell title="PG & Hostels" subtitle="Find your perfect paying guest accommodation">
      <SEO title="PG & Hostels" description="Browse PGs and hostels near your college or workplace" path="/pgs" />
      <div className="space-y-6 pb-24">
        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-base-content/50" />
            <input
              type="text"
              placeholder="Search by area, college, or PG name..."
              className="input input-bordered w-full pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`btn btn-xs rounded-full ${gender === g ? "btn-primary" : "btn-outline"}`}
                  onClick={() => setGender(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`btn btn-xs rounded-full gap-1 ${foodOnly ? "btn-success text-white" : "btn-outline"}`}
              onClick={() => setFoodOnly(!foodOnly)}
            >
              <UtensilsCrossed className="size-3" /> Food
            </button>
            <select
              className="select select-xs select-bordered rounded-full"
              value={sharing}
              onChange={(e) => setSharing(e.target.value)}
            >
              {SHARING_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === "All" ? "All Sharing" : `${s} Sharing`}</option>
              ))}
            </select>
            <select
              className="select select-xs select-bordered rounded-full"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="recent">Recent</option>
              <option value="price">Price: Low to High</option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center py-20">
            <div className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!isLoading && !search && (
          <>
            {/* Top Rated Section */}
            {topRated.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="size-4 text-yellow-500 fill-yellow-500" />
                  <h2 className="text-lg font-bold">Top Rated PGs</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                  {topRated.map((post) => (
                    <div key={post._id} className="w-72 shrink-0">
                      <PropertyPostCard post={{ ...post, media: Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []) }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recently Added */}
            {recentlyAdded.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="size-4 text-primary" />
                  <h2 className="text-lg font-bold">Recently Added</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                  {recentlyAdded.map((post) => (
                    <div key={post._id} className="w-72 shrink-0">
                      <PropertyPostCard post={{ ...post, media: Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []) }} />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Near College Sections */}
            {collegePgs.map(([college, posts]) => (
              <section key={college}>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="size-4 text-secondary" />
                  <h2 className="text-lg font-bold">Near {college}</h2>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
                  {posts.map((post) => (
                    <div key={post._id} className="w-72 shrink-0">
                      <PropertyPostCard post={{ ...post, media: Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []) }} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </>
        )}

        {/* All PGs Grid */}
        <section>
          <h2 className="text-lg font-bold mb-3">
            {search ? `Search Results (${filtered.length})` : `All PGs (${filtered.length})`}
          </h2>
          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-12 text-base-content/50">
              <Building2 className="size-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No PGs found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((post) => (
              <PropertyPostCard
                key={post._id}
                post={{ ...post, media: Array.isArray(post.media) ? post.media : (post.media ? [post.media] : []) }}
              />
            ))}
          </div>
          {hasNextPage && (
            <div className="flex justify-center mt-6">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
