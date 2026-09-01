import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  House,
  IndianRupee,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Search,
  Share2,
  SlidersHorizontal,
} from "lucide-react";
import toast from "react-hot-toast";
import UserAvatar from "../components/UserAvatar";
import CommentSection from "../components/CommentSection";
import axiosInstance from "../lib/axios";

const LEFT_MENU = [
  "Home",
  "Discover",
  "Map View",
  "Messages",
  "Saved Properties",
  "My Requirements",
  "Following",
  "Alerts",
];

const POST_MENU = ["My Properties", "My Posts", "Create Post"];
const STORY_ITEMS = ["For You", "New Projects", "Top Brokers", "Deals", "Near Me", "Luxury", "Agricultural", "Following"];
const FEED_TABS = ["For You", "Following", "Near Me"];
const LISTING_TYPES = ["All", "Sell", "Rent", "Requirement", "Project", "Agricultural Land"];
const PROPERTY_TYPES = ["All", "Apartment", "Independent House", "Villa", "Plot", "Commercial", "Agricultural Land"];

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount) || amount <= 0) return "Price on request";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeMedia(post) {
  return Array.isArray(post.mediaUrls) && post.mediaUrls.length
    ? post.mediaUrls
    : ["https://placehold.co/1200x800?text=NearMySpace+Listing"];
}

function isVideoUrl(url) {
  const videoExtensions = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
  return videoExtensions.some((ext) => String(url).toLowerCase().endsWith(ext));
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const authData = queryClient.getQueryData(["authUser"]);
  const authUser = authData?.data?.user || authData?.data || null;

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("For You");
  const [carouselIndex, setCarouselIndex] = useState({});
  const [selectedPostForComments, setSelectedPostForComments] = useState(null);
  const [expandedPostIds, setExpandedPostIds] = useState({});

  const [filters, setFilters] = useState({
    transactionType: "All",
    propertyType: "All",
    city: "",
    locality: "",
    budgetMin: 0,
    budgetMax: 10000000,
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["propertyFeed", search, appliedFilters.transactionType, appliedFilters.propertyType],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams();
      params.set("page", String(pageParam));
      params.set("limit", "12");
      if (search.trim()) params.set("q", search.trim());
      if (appliedFilters.transactionType !== "All") params.set("listingType", appliedFilters.transactionType);
      if (appliedFilters.propertyType !== "All") params.set("propertyType", appliedFilters.propertyType);
      const response = await axiosInstance.get(`/posts?${params.toString()}`);
      return response.data?.data || { posts: [], pagination: { page: 1, totalPages: 1 } };
    },
    getNextPageParam: (lastPage) => {
      const current = Number(lastPage?.pagination?.page || 1);
      const total = Number(lastPage?.pagination?.totalPages || 1);
      return current < total ? current + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: Boolean(authUser?._id),
  });

  const posts = useMemo(() => {
    const allPosts = (data?.pages || []).flatMap((page) => page?.posts || []);
    return allPosts
      .filter((post) => {
        const cityOk = appliedFilters.city ? String(post.city || "").toLowerCase().includes(appliedFilters.city.toLowerCase()) : true;
        const localityOk = appliedFilters.locality
          ? `${post.locality || ""} ${post.caption || ""}`.toLowerCase().includes(appliedFilters.locality.toLowerCase())
          : true;
        const price = Number(post.price || 0);
        const minOk = price >= Number(appliedFilters.budgetMin || 0);
        const maxOk = Number(appliedFilters.budgetMax || 0) <= 0 ? true : price <= Number(appliedFilters.budgetMax || 0);
        return cityOk && localityOk && minOk && maxOk;
      })
      .map((post) => ({
        ...post,
        media: normalizeMedia(post),
        likesCount: Number(post.likesCount || 0),
      }));
  }, [appliedFilters, data]);

  const { mutate: toggleLike } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/like`);
      return response.data?.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["propertyFeed"] }),
  });

  const { mutate: toggleSave } = useMutation({
    mutationFn: async (postId) => {
      const response = await axiosInstance.post(`/posts/${postId}/save`);
      return response.data?.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["propertyFeed"] }),
  });

  const { mutate: logout, isPending: loggingOut } = useMutation({
    mutationFn: async () => {
      const response = await axiosInstance.post("/auth/logout");
      return response.data;
    },
    onSuccess: () => {
      toast.success("Logged out successfully");
      // setQueryData already clears the cache; invalidating on top of that would
      // just trigger a pointless extra /auth/verify call that returns 401.
      queryClient.setQueryData(["authUser"], null);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || "Logout failed");
    },
  });

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f8fc_0%,#f3f5fb_100%)] text-base-content">
      <header className="sticky top-0 z-40 border-b border-base-300 bg-base-100/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 py-3 lg:px-6">
          <div className="flex min-w-[180px] items-center gap-2">
            <div className="grid size-10 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <House className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-black tracking-tight text-base-content">NearMySpace</p>
              <p className="text-xs text-base-content/60">Social Real Estate Marketplace</p>
            </div>
          </div>

          <label className="input input-bordered hidden h-11 flex-1 max-w-xl rounded-xl border-base-300 bg-base-200 lg:flex">
            <Search className="size-4 text-base-content/50" />
            <input
              type="text"
              placeholder="Search city, locality, property or builder"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="btn btn-primary h-11 rounded-xl" onClick={() => navigate("/marketplace?openComposer=1")}>
              <Plus className="size-4" />
              Create Post
            </button>
            <button type="button" className="btn btn-ghost btn-circle"><MessageCircle className="size-4" /></button>
            <button type="button" className="btn btn-ghost btn-circle"><Bell className="size-4" /></button>
            <div className="hidden items-center gap-2 rounded-xl border border-base-300 px-2 py-1.5 sm:flex">
              <UserAvatar src={authUser?.profilePic} name={authUser?.fullName || "User"} sizeClass="size-8" userId={authUser?._id} />
              <div>
                <p className="text-xs font-semibold leading-tight">{authUser?.fullName || "User"}</p>
                <p className="text-[11px] text-base-content/60">{authUser?.activeRole || authUser?.primaryRole || "Buyer"}</p>
              </div>
            </div>
            <button type="button" className="btn btn-ghost btn-circle lg:hidden"><Menu className="size-5" /></button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1440px] gap-4 p-4 pb-8 lg:p-6 lg:pb-8 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside className="hidden rounded-2xl border border-base-300 bg-base-100 p-4 pb-6 shadow-sm xl:flex xl:flex-col xl:min-h-[calc(100vh-8rem)]">
          <div className="space-y-1">
            {LEFT_MENU.map((item, index) => (
              <button key={item} type="button" className={`btn btn-sm h-10 w-full justify-start rounded-lg ${index === 0 ? "btn-primary" : "btn-ghost"}`}>
                {item}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-base-content/60">Posts</p>
          <div className="mt-2 space-y-1">
            {POST_MENU.map((item) => (
              <button key={item} type="button" className="btn btn-sm h-10 w-full justify-start rounded-lg btn-ghost">
                {item}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-base-content/60">More</p>
          <div className="mt-2 grid gap-1">
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost">Dashboard</button>
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost">Transactions</button>
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost">Reviews</button>
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost">Settings</button>
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost">Help & Support</button>
            <button type="button" className="btn btn-sm h-10 justify-start rounded-lg btn-ghost" disabled={loggingOut} onClick={() => logout()}>
              {loggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <div className="mt-auto rounded-xl bg-primary/10 p-3 text-xs text-base-content">
            <p className="font-semibold text-primary">Go Premium</p>
            <p className="mt-1">Get more visibility and reach serious buyers faster.</p>
            <button type="button" className="btn btn-primary btn-sm mt-3 w-full rounded-lg">Upgrade Now</button>
          </div>
        </aside>

        <section className="space-y-4 pb-6">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-3 shadow-sm lg:p-4">
            <div className="flex items-center gap-4 overflow-x-auto pb-2">
              {STORY_ITEMS.map((item, idx) => (
                <button key={item} type="button" className="min-w-[5rem] text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-full bg-gradient-to-br from-primary to-info p-[2px]">
                    <span className="grid size-full place-items-center rounded-full bg-base-100 text-[10px] font-bold text-primary">{idx + 1}</span>
                  </span>
                  <span className="mt-1 block truncate text-[11px] font-semibold text-base-content">{item}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-base-300 pt-3">
              <div className="flex items-center gap-1 overflow-x-auto">
                {FEED_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`btn btn-sm rounded-full ${activeTab === tab ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn-sm btn-outline rounded-full border-base-300">
                Latest
                <ChevronDown className="size-3.5" />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-72 animate-pulse rounded-2xl bg-base-300" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-base-300 bg-base-100 p-10 text-center text-sm text-base-content/60">No listings found for current filters.</div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => {
                const index = Number(carouselIndex[post._id] || 0);
                const image = post.media[index] || post.media[0];
                const verified = ["Broker", "Seller", "Landlord"].includes(post.author?.activeRole || post.author?.primaryRole);

                return (
                  <article key={post._id} className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm" onClick={() => console.log("Article clicked")}>
                    <div className="relative">
                      {post.media.length > 0 ? (
                        isVideoUrl(image) ? (
                          <video src={image} alt={post.title || "Property"} className="h-44 w-full object-cover" controls onDoubleClick={() => toggleLike(post._id)} />
                        ) : (
                          <img src={image} alt={post.title || "Property"} className="h-44 w-full object-cover" loading="lazy" onDoubleClick={() => toggleLike(post._id)} />
                        )
                      ) : (
                        <img src={image} alt={post.title || "Property"} className="h-44 w-full object-cover" loading="lazy" onDoubleClick={() => toggleLike(post._id)} />
                      )}
                      {post.media.length > 1 ? (
                        <>
                          <button type="button" className="btn btn-xs btn-circle absolute left-2 top-1/2 -translate-y-1/2 bg-white/90" onClick={() => setCarouselIndex((prev) => ({ ...prev, [post._id]: index === 0 ? post.media.length - 1 : index - 1 }))}><ChevronLeft className="size-3" /></button>
                          <button type="button" className="btn btn-xs btn-circle absolute right-2 top-1/2 -translate-y-1/2 bg-white/90" onClick={() => setCarouselIndex((prev) => ({ ...prev, [post._id]: index === post.media.length - 1 ? 0 : index + 1 }))}><ChevronRight className="size-3" /></button>
                        </>
                      ) : null}
                    </div>

                    <div className="p-3">
                      <p className="inline-flex items-center gap-0.5 text-xl font-black text-base-content"><IndianRupee className="size-4 text-primary" />{formatMoney(post.price).replace("₹", "")}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm font-semibold text-base-content">{post.title || "Property listing"}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-base-content/60"><MapPin className="size-3" />{post.locality || post.city || "Location"}</p>
                      <p className="mt-1 text-xs text-base-content/70">{post.bedrooms || 0} Beds · {post.bathrooms || 0} Baths · {Number(post.areaSqft || 0)} sqft</p>
                      
                      {post.caption ? (
                        <div className="mt-2">
                          <p className={`text-xs text-base-content/70 ${expandedPostIds[post._id] ? "" : "line-clamp-2"}`}>
                            {post.caption}
                          </p>
                          {post.caption.length > 100 && (
                            <button
                              type="button"
                              className="mt-1 text-xs text-primary hover:text-primary font-medium"
                              onClick={() => setExpandedPostIds((prev) => ({ ...prev, [post._id]: !prev[post._id] }))}
                            >
                              {expandedPostIds[post._id] ? "Show less" : "Read more"}
                            </button>
                          )}
                        </div>
                      ) : null}

                      <div className="mt-3 flex items-center gap-4">
                        <div className="flex items-center gap-1">
                          <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => toggleLike(post._id)}><Heart className={`size-4 ${post.isLikedByMe ? "fill-error text-error" : ""}`} /></button>
                          <span className="text-[11px] text-base-content/60">{post.likesCount}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" className="btn btn-ghost btn-xs btn-circle !z-50 !relative" onClick={() => { console.log("Comment button clicked, post:", post); setSelectedPostForComments(post); }}><MessageCircle className="size-4" /></button>
                          <span className="text-[11px] text-base-content/60">{post.commentCount || 0}</span>
                        </div>
                        <button type="button" className="btn btn-ghost btn-xs btn-circle"><Share2 className="size-4" /></button>
                        <div className="flex items-center gap-1">
                          <button type="button" className="btn btn-ghost btn-xs btn-circle" onClick={() => toggleSave(post._id)}><Bookmark className={`size-4 ${post.isSavedByMe ? "fill-primary text-primary" : ""}`} /></button>
                          <span className="text-[11px] text-base-content/60">{post.savesCount || 0}</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex min-w-0 items-center gap-2">
                          <UserAvatar src={post.author?.profilePic} name={post.author?.fullName || "User"} sizeClass="size-7" userId={post.author?._id} />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold text-base-content">{post.author?.fullName || "Unknown"}</p>
                            <p className="truncate text-[11px] text-base-content/60">{post.author?.activeRole || post.author?.primaryRole || "User"}</p>
                          </div>
                        </div>
                        {verified ? <BadgeCheck className="size-4 text-primary" /> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {hasNextPage ? (
            <button type="button" className="btn btn-outline w-full rounded-xl border-base-300 bg-base-100" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>
              {isFetchingNextPage ? "Loading..." : "Load More"}
            </button>
          ) : null}
        </section>

        <aside className="hidden gap-4 xl:flex xl:flex-col pb-6">
          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-base-content">Stories & Highlights</p>
              <button type="button" className="btn btn-ghost btn-xs text-primary">View all</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {["Premium Projects", "Hot Deals", "New Launches", "Top Brokers"].map((item, idx) => (
                <div key={item} className="rounded-xl border border-base-300 p-2">
                  <img src={`https://placehold.co/320x220?text=${idx + 1}`} alt={item} className="h-16 w-full rounded-lg object-cover" />
                  <p className="mt-1 text-[11px] font-semibold text-base-content">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-base-content">Smart Filters</p>
              <SlidersHorizontal className="size-4 text-base-content/60" />
            </div>

            <div className="grid gap-2">
              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">Transaction Type</span>
                <select className="select select-bordered select-sm border-base-300" value={filters.transactionType} onChange={(event) => setFilters((prev) => ({ ...prev, transactionType: event.target.value }))}>
                  {LISTING_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">Property Type</span>
                <select className="select select-bordered select-sm border-base-300" value={filters.propertyType} onChange={(event) => setFilters((prev) => ({ ...prev, propertyType: event.target.value }))}>
                  {PROPERTY_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>

              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">City</span>
                <input className="input input-bordered input-sm border-base-300" value={filters.city} onChange={(event) => setFilters((prev) => ({ ...prev, city: event.target.value }))} />
              </label>

              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">Locality</span>
                <input className="input input-bordered input-sm border-base-300" value={filters.locality} onChange={(event) => setFilters((prev) => ({ ...prev, locality: event.target.value }))} />
              </label>

              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">Budget Min</span>
                <input className="input input-bordered input-sm border-base-300" type="number" min="0" value={filters.budgetMin} onChange={(event) => setFilters((prev) => ({ ...prev, budgetMin: Number(event.target.value || 0) }))} />
              </label>

              <label className="form-control">
                <span className="label-text text-xs text-base-content/70">Budget Max</span>
                <input className="input input-bordered input-sm border-base-300" type="number" min="0" value={filters.budgetMax} onChange={(event) => setFilters((prev) => ({ ...prev, budgetMax: Number(event.target.value || 0) }))} />
              </label>
            </div>

            <button type="button" className="btn btn-primary btn-sm mt-3 w-full rounded-lg" onClick={() => setAppliedFilters(filters)}>
              Apply Filters
            </button>
          </div>

          <div className="rounded-2xl border border-base-300 bg-base-100 p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-base-content">Recommended for You</p>
              <button type="button" className="btn btn-ghost btn-xs text-primary">View all</button>
            </div>
            <div className="space-y-2">
              {posts.slice(0, 3).map((post) => (
                <Link key={`rec-${post._id}`} to="/marketplace" className="flex items-center gap-2 rounded-lg border border-base-300 p-2 hover:bg-base-200">
                  <img src={post.media[0]} alt={post.title || "Recommendation"} className="h-12 w-16 rounded-md object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-base-content">{post.title || "Property"}</p>
                    <p className="truncate text-[11px] text-base-content/60">{formatMoney(post.price)} · {post.city || "India"}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <button type="button" className="btn btn-primary btn-circle fixed bottom-5 right-5 z-40 h-14 w-14 shadow-xl xl:hidden" onClick={() => navigate("/marketplace?openComposer=1")}>
        <Plus className="size-6" />
      </button>

      {selectedPostForComments ? (
        <>
          {console.log("Rendering CommentSection with post:", selectedPostForComments)}
          <CommentSection
            post={selectedPostForComments}
            onClose={() => { console.log("Closing comment section"); setSelectedPostForComments(null); }}
          />
        </>
      ) : null}
    </div>
  );
}
