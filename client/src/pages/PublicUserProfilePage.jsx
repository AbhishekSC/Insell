import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Lock, Loader2, BadgeCheck } from "lucide-react";
import axiosInstance from "../lib/axios";
import LoginPromptModal from "../components/LoginPromptModal";
import logoDesktop from "../assets/brand/logo-desktop.png";

function Stat({ label, value, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left transition-opacity hover:opacity-70"
    >
      <span className="font-bold text-base-content">{value}</span>{" "}
      <span className="text-base-content/60">{label}</span>
    </button>
  );
}

export default function PublicUserProfilePage() {
  const { userId } = useParams();
  const [prompt, setPrompt] = useState(null); // { context }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["publicProfile", userId],
    queryFn: async () => {
      const res = await axiosInstance.get(`/public/users/${userId}`, { skipErrorToast: true });
      return res.data?.data?.profile;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-base-content/40">
        <Loader2 className="size-7 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-lg font-semibold text-base-content">This profile isn't available</h1>
        <p className="mt-1 text-sm text-base-content/60">It may have been removed or set to private.</p>
        <Link to="/marketplace" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Browse NearMySpace →
        </Link>
      </div>
    );
  }

  const p = data;
  const gate = (context) => () => setPrompt({ context });

  return (
    <div className="min-h-screen bg-base-100">
      {/* Slim top bar for logged-out visitors */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-base-200 bg-base-100/90 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="NearMySpace home" className="flex items-center">
          <img src={logoDesktop} alt="NearMySpace" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/login?next=/users/${userId}`} className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white">
            Log in
          </Link>
          <Link to="/signup" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary">
            Sign up
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* Header */}
        <div className="flex items-start gap-5">
          <img
            src={p.avatar || "/favicon.png"}
            alt={p.name}
            className="size-20 shrink-0 rounded-full object-cover sm:size-28"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-xl font-semibold text-base-content">{p.name}</h1>
            </div>
            {p.isOwnerVerified && (
              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary">
                <BadgeCheck className="size-3.5" />
                Verified Owner
              </span>
            )}

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span>
                <span className="font-bold text-base-content">{p.postsCount}</span>{" "}
                <span className="text-base-content/60">listings</span>
              </span>
              <Stat label="connections" value={p.connectionsCount} onClick={gate("connections")} />
              {p.rating && (
                <span>
                  <span className="font-bold text-base-content">{p.rating.avg}★</span>{" "}
                  <span className="text-base-content/60">({p.rating.count})</span>
                </span>
              )}
            </div>

            {p.city && (
              <p className="mt-1.5 flex items-center gap-1 text-sm text-base-content/60">
                <MapPin className="size-3.5" /> {p.city}
              </p>
            )}
          </div>
        </div>

        {p.bio && <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-base-content">{p.bio}</p>}

        <button
          type="button"
          onClick={gate("follow")}
          className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white sm:w-auto sm:px-8"
        >
          Follow
        </button>

        {/* Post grid — first few, rest gated */}
        {p.previewPosts.length > 0 ? (
          <>
            <div className="mt-8 grid grid-cols-3 gap-1 sm:gap-2">
              {p.previewPosts.map((post) => (
                <button
                  type="button"
                  key={post.id}
                  onClick={gate("post")}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-base-200"
                >
                  {post.coverImage ? (
                    <img src={post.coverImage} alt={post.title} className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-base-content/30">
                      <MapPin className="size-6" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-left text-[11px] font-medium text-white">
                    {post.priceLabel} · {post.title}
                  </span>
                </button>
              ))}
            </div>

            {p.hasMorePosts && (
              <button
                type="button"
                onClick={gate("posts")}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-base-300 py-3 text-sm font-semibold text-base-content hover:bg-base-200"
              >
                <Lock className="size-4" />
                Show all {p.postsCount} listings from {p.name}
              </button>
            )}
          </>
        ) : (
          <p className="mt-10 text-center text-sm text-base-content/50">No public listings yet.</p>
        )}

        {/* Related profiles */}
        {p.related.length > 0 && (
          <div className="mt-12">
            <h2 className="mb-3 text-sm font-semibold text-base-content/70">People you may know on NearMySpace</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {p.related.map((r) => (
                <Link
                  key={r.id}
                  to={`/users/${r.id}`}
                  className="flex w-32 shrink-0 flex-col items-center rounded-xl border border-base-300 p-3 text-center hover:bg-base-200"
                >
                  <img src={r.avatar || "/favicon.png"} alt="" className="size-14 rounded-full object-cover" />
                  <span className="mt-2 flex w-full min-w-0 items-center justify-center gap-1 text-xs font-semibold text-base-content">
                    <span className="min-w-0 truncate">{r.name}</span>
                  </span>
                  {r.city && <span className="w-full truncate text-[11px] text-base-content/50">{r.city}</span>}
                </Link>
              ))}
            </div>
          </div>
        )}

        <p className="mt-12 border-t border-base-200 pt-6 text-center text-xs text-base-content/40">
          NearMySpace — verified owners, no brokers.{" "}
          <Link to="/signup" className="font-semibold text-primary">Create your account</Link>
        </p>
      </div>

      <LoginPromptModal
        open={Boolean(prompt)}
        onClose={() => setPrompt(null)}
        context={prompt?.context}
        name={p.name}
        avatar={p.avatar}
      />
    </div>
  );
}
