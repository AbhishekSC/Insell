import { useState } from "react";
import { useParams, Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck, MapPin, Bed, Bath, Ruler, Building2, Phone,
  IndianRupee, CalendarClock, Bookmark, Loader2,
} from "lucide-react";
import axiosInstance from "../lib/axios";
import LoginPromptModal from "../components/LoginPromptModal";
import logoDesktop from "../assets/brand/logo-desktop.png";

const isVideo = (u) => /\/video\/upload\/|\.(mp4|mov|webm|m4v)(\?|$)/i.test(u || "");

export default function PublicPropertyDetailPage() {
  const { id } = useParams();
  const [prompt, setPrompt] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["publicListing", id],
    queryFn: async () => {
      const res = await axiosInstance.get(`/public/listings/${id}`, { skipErrorToast: true });
      return res.data?.data?.listing;
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
        <h1 className="text-lg font-semibold text-base-content">This listing isn't available</h1>
        <p className="mt-1 text-sm text-base-content/60">It may have been removed or is no longer public.</p>
        <Link to="/marketplace" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
          Browse other properties →
        </Link>
      </div>
    );
  }

  const p = data;
  const gate = (context) => () => setPrompt({ context });
  const images = (p.images || []).filter((u) => !isVideo(u));
  const cover = images[activeImg] || images[0] || null;

  const specs = [
    p.bedrooms ? { icon: Bed, label: `${p.bedrooms} Bed` } : null,
    p.bathrooms ? { icon: Bath, label: `${p.bathrooms} Bath` } : null,
    p.areaSqft ? { icon: Ruler, label: `${Number(p.areaSqft).toLocaleString("en-IN")} sqft` } : null,
    p.propertyType ? { icon: Building2, label: p.propertyType } : null,
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-base-100">
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-base-200 bg-base-100/90 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="NearMySpace home" className="flex items-center">
          <img src={logoDesktop} alt="NearMySpace" className="h-8 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <Link to={`/login?next=/property/${id}`} className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white">Log in</Link>
          <Link to="/signup" className="rounded-lg px-3 py-1.5 text-sm font-semibold text-primary">Sign up</Link>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-5">
        {/* Gallery */}
        {cover && (
          <div className="overflow-hidden rounded-2xl bg-base-200">
            <img src={cover} alt={p.title} className="aspect-[4/3] w-full object-cover" />
          </div>
        )}
        {images.length > 1 && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {images.map((src, i) => (
              <button
                key={src}
                onClick={() => setActiveImg(i)}
                className={`size-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}
              >
                <img src={src} alt="" className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Price + title */}
        <div className="mt-5">
          {p.badge && (
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-primary">
              {p.badge}
            </span>
          )}
          <div className="mt-2 flex items-center gap-1 text-2xl font-extrabold text-base-content">
            <IndianRupee className="size-5" />
            {p.priceLabel.replace("₹", "")}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-base-content">{p.title}</h1>
          {p.locationLabel && (
            <p className="mt-1 flex items-center gap-1 text-sm text-base-content/60">
              <MapPin className="size-3.5" /> {p.locationLabel}
            </p>
          )}
        </div>

        {/* Specs */}
        {specs.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {specs.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5 rounded-lg bg-base-200 px-3 py-1.5 text-sm text-base-content/80">
                <s.icon className="size-4" /> {s.label}
              </span>
            ))}
          </div>
        )}

        {/* Actions — all gated */}
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button onClick={gate("contact")} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white sm:col-span-2">
            <Phone className="size-4" /> Contact owner
          </button>
          <button onClick={gate("offer")} className="flex items-center justify-center gap-2 rounded-xl border border-base-300 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200">
            <IndianRupee className="size-4" /> Offer
          </button>
          <button onClick={gate("visit")} className="flex items-center justify-center gap-2 rounded-xl border border-base-300 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200">
            <CalendarClock className="size-4" /> Visit
          </button>
          <button onClick={gate("save")} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-base-300 py-2.5 text-sm font-semibold text-base-content hover:bg-base-200 sm:col-span-4">
            <Bookmark className="size-4" /> Save this listing
          </button>
        </div>

        {/* Owner */}
        {p.author && (
          <Link to={`/users/${p.author.id}`} className="mt-5 flex items-center gap-3 rounded-xl border border-base-300 p-3 hover:bg-base-200">
            <img src={p.author.avatar || "/favicon.png"} alt="" className="size-11 rounded-full object-cover" />
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-sm font-semibold text-base-content">
                {p.author.name}
                {p.author.isVerified && <BadgeCheck className="size-4 text-primary" />}
              </p>
              <p className="text-xs text-base-content/50">Listed by owner{p.author.city ? ` · ${p.author.city}` : ""}</p>
            </div>
          </Link>
        )}

        {/* Description */}
        {p.description && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-base-content">About this property</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-base-content/80">{p.description}</p>
          </div>
        )}

        {/* Key details */}
        {p.keyDetails.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-base-content">Details</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
              {p.keyDetails.map((d) => (
                <div key={d.label} className="flex justify-between border-b border-base-200 pb-1.5">
                  <span className="text-base-content/50">{d.label}</span>
                  <span className="font-medium text-base-content">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amenities */}
        {p.amenities.length > 0 && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold text-base-content">Amenities</h2>
            <div className="flex flex-wrap gap-2">
              {p.amenities.map((a) => (
                <span key={a} className="rounded-lg bg-base-200 px-2.5 py-1 text-xs text-base-content/70">{a}</span>
              ))}
            </div>
          </div>
        )}

        {/* Similar listings — horizontal scroll */}
        {p.related.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-3 text-sm font-semibold text-base-content/70">Similar listings</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {p.related.map((r) => (
                <Link
                  key={r.id}
                  to={`/property/${r.id}`}
                  className="w-44 shrink-0 overflow-hidden rounded-xl border border-base-300 hover:bg-base-200"
                >
                  <div className="aspect-[4/3] bg-base-200">
                    {r.coverImage && <img src={r.coverImage} alt={r.title} className="size-full object-cover" />}
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-semibold text-base-content">{r.priceLabel}</p>
                    <p className="truncate text-xs text-base-content/60">{r.title}</p>
                    {r.location && <p className="truncate text-[11px] text-base-content/40">{r.location}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* People you may know */}
        {p.people?.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold text-base-content/70">People you may know on NearMySpace</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {p.people.map((u) => (
                <Link
                  key={u.id}
                  to={`/users/${u.id}`}
                  className="flex w-32 shrink-0 flex-col items-center rounded-xl border border-base-300 p-3 text-center hover:bg-base-200"
                >
                  <img src={u.avatar || "/favicon.png"} alt="" className="size-14 rounded-full object-cover" />
                  <span className="mt-2 flex w-full min-w-0 items-center justify-center gap-1 text-xs font-semibold text-base-content">
                    <span className="min-w-0 truncate">{u.name}</span>
                    {u.isVerified && <BadgeCheck className="size-3 shrink-0 text-primary" />}
                  </span>
                  {u.city && <span className="w-full truncate text-[11px] text-base-content/50">{u.city}</span>}
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
        name={p.author?.name || "the owner"}
        avatar={p.author?.avatar}
      />
    </div>
  );
}
