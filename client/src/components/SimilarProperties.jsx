import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Building2, Bed, Bath, MapPin } from "lucide-react";
import axiosInstance from "../lib/axios";

function formatMoney(amount) {
  const num = Number(amount);
  if (!num) return "Price on request";
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  return `₹${num.toLocaleString("en-IN")}`;
}

function firstImage(post) {
  const urls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  return urls.find((u) => u && !/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(u)) || null;
}

// "More listings like this" carousel for the property detail page. Fetches
// GET /posts/:id/similar (scored server-side on type/location/price) and
// renders a horizontally-scrollable strip of compact cards.
export default function SimilarProperties({ postId }) {
  const { data, isLoading } = useQuery({
    queryKey: ["similarProperties", postId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/posts/${postId}/similar`, { params: { limit: 10 } });
      return res.data?.data?.posts || [];
    },
    enabled: Boolean(postId),
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6 md:p-8">
        <h2 className="text-xl font-semibold text-base-content mb-6">More listings like this</h2>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-56 w-56 shrink-0 animate-pulse rounded-xl bg-base-200" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <div className="bg-base-100 rounded-2xl shadow-sm border border-base-300 p-6 md:p-8">
      <h2 className="text-xl font-semibold text-base-content mb-6">More listings like this</h2>
      <div className="-mx-2 flex gap-4 overflow-x-auto px-2 pb-2 [scrollbar-width:thin]">
        {data.map((post) => {
          const img = firstImage(post);
          return (
            <Link
              key={post._id}
              to={`/property/${post._id}`}
              className="group w-56 shrink-0 overflow-hidden rounded-xl border border-base-300 bg-base-100 transition hover:shadow-md"
            >
              <div className="h-36 w-full bg-base-200">
                {img ? (
                  <img src={img} alt={post.title || "Property"} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-base-content/30">
                    <Building2 className="size-8" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="text-base font-bold text-base-content">{formatMoney(post.price)}</p>
                <p className="mt-0.5 line-clamp-1 text-sm text-base-content/80">{post.title || "Listing"}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-base-content/50">
                  <MapPin className="size-3" />
                  <span className="line-clamp-1">{[post.locality, post.city].filter(Boolean).join(", ") || "—"}</span>
                </p>
                {(post.bedrooms > 0 || post.bathrooms > 0) && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-base-content/60">
                    {post.bedrooms > 0 && (
                      <span className="flex items-center gap-1"><Bed className="size-3" />{post.bedrooms}</span>
                    )}
                    {post.bathrooms > 0 && (
                      <span className="flex items-center gap-1"><Bath className="size-3" />{post.bathrooms}</span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
