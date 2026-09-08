import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck, ShieldCheck, MapPin, Handshake, Loader2, ArrowRight, Search,
} from "lucide-react";
import axiosInstance from "../lib/axios";
import logoDesktop from "../assets/brand/logo-desktop.png";

function ListingCard({ l, blurred }) {
  const body = (
    <>
      <div className="aspect-[4/3] w-full bg-base-200">
        {l.coverImage && <img src={l.coverImage} alt={l.title} className="size-full object-cover" loading="lazy" />}
      </div>
      <div className="p-3">
        {l.badge && <span className="text-[10px] font-bold uppercase tracking-wide text-primary">{l.badge}</span>}
        <p className="text-base font-bold text-base-content">{l.priceLabel}</p>
        <p className="truncate text-sm font-medium text-base-content">{l.title}</p>
        {l.location && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-base-content/50">
            <MapPin className="size-3 shrink-0" /> {l.location}
          </p>
        )}
        {l.specsLabel && <p className="mt-0.5 truncate text-xs text-base-content/50">{l.specsLabel}</p>}
      </div>
    </>
  );

  if (blurred) {
    return (
      <div className="pointer-events-none overflow-hidden rounded-2xl border border-base-300 bg-base-100 opacity-60 blur-[2px]">
        {body}
      </div>
    );
  }
  return (
    <Link
      to={`/property/${l.id}`}
      className="overflow-hidden rounded-2xl border border-base-300 bg-base-100 transition-shadow hover:shadow-md"
    >
      {body}
    </Link>
  );
}

// A small tilted mini-card for the hero collage — just image + price + place.
function MiniCard({ l, className }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-xl ${className}`}>
      <div className="aspect-[5/3] w-full bg-base-200">
        {l.coverImage && <img src={l.coverImage} alt="" className="size-full object-cover" loading="lazy" />}
      </div>
      <div className="p-2.5">
        <p className="text-sm font-bold text-base-content">{l.priceLabel}</p>
        <p className="truncate text-[11px] text-base-content/50">{l.location || l.title}</p>
      </div>
    </div>
  );
}

const TRUST = [
  { icon: BadgeCheck, label: "Verified owners" },
  { icon: ShieldCheck, label: "No brokers, no spam" },
  { icon: Handshake, label: "In-app deal tracker" },
];

export default function GuestLandingPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["guestFeed"],
    queryFn: async () => {
      const res = await axiosInstance.get("/public/feed", { skipErrorToast: true });
      return res.data?.data?.listings || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const listings = data || [];
  const shown = listings.slice(0, 6);
  const teased = listings.slice(6, 9);
  const collage = listings.slice(0, 3);

  const startSearch = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/signup?next=${encodeURIComponent(`/marketplace?q=${q.trim()}`)}` : "/signup");
  };

  return (
    <div className="min-h-screen bg-base-100">
      <style>{`
        @keyframes gl-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .gl-rise { animation: gl-rise .6s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .gl-rise { animation: none; } }
      `}</style>

      {/* Top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-base-200 bg-base-100/85 px-4 py-3 backdrop-blur sm:px-8">
        <img src={logoDesktop} alt="NearMySpace" className="h-8 w-auto" />
        <div className="flex items-center gap-2">
          <Link to="/login" className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-primary hover:bg-primary/5">
            Log in
          </Link>
          <Link to="/signup" className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-primary/90">
            Sign up
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* ambient glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]"
        />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          {/* Left */}
          <div className="gl-rise">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> A social real-estate marketplace
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-base-content sm:text-5xl">
              Property, without <br className="hidden sm:block" />the brokers.
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-base-content/60">
              Buy, rent or sell — homes, shops, plots, farmland — in a feed. Every listing tied to a
              verified owner. Message, negotiate and close the whole deal in one place.
            </p>

            <form onSubmit={startSearch} className="mt-6 flex max-w-md items-center gap-2 rounded-xl border border-base-300 bg-base-100 p-1.5 shadow-sm focus-within:border-primary/40">
              <Search className="ml-2 size-4 shrink-0 text-base-content/40" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a city or locality…"
                className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none"
              />
              <button type="submit" className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                Search
              </button>
            </form>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/signup" className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90">
                Create free account
              </Link>
              <Link to="/login" className="rounded-xl border border-base-300 bg-base-100 px-6 py-3 text-sm font-semibold text-base-content hover:bg-base-200">
                Log in
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {TRUST.map((t) => {
                const TrustIcon = t.icon;
                return (
                  <span key={t.label} className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-3 py-1.5 text-xs font-medium text-base-content/70">
                    <TrustIcon className="size-3.5 text-primary" /> {t.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Right — live listing collage */}
          <div className="gl-rise relative hidden h-[26rem] lg:block" style={{ animationDelay: "0.08s" }}>
            {isLoading || collage.length < 3 ? (
              <div className="grid h-full place-items-center rounded-3xl border border-base-200 bg-base-200/40 text-base-content/30">
                <Loader2 className="size-6 animate-spin" />
              </div>
            ) : (
              <>
                <MiniCard l={collage[0]} className="absolute left-0 top-2 w-64 -rotate-6" />
                <MiniCard l={collage[1]} className="absolute right-0 top-16 w-60 rotate-3" />
                <MiniCard l={collage[2]} className="absolute bottom-0 left-10 w-64 rotate-[-2deg]" />
                <div className="absolute bottom-6 right-2 rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-xl">
                  <p className="text-lg font-extrabold text-primary">0</p>
                  <p className="text-[11px] text-base-content/50">brokers involved</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Teaser feed */}
      <section className="mx-auto max-w-5xl px-4 pb-16">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-base-content/50">
          Live on NearMySpace right now
        </h2>

        {isLoading ? (
          <div className="grid place-items-center py-16 text-base-content/40">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((l) => (
                <ListingCard key={l.id} l={l} />
              ))}
            </div>

            {teased.length > 0 && (
              <div className="relative mt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {teased.map((l) => (
                    <ListingCard key={l.id} l={l} blurred />
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-base-100 via-base-100/70 to-transparent">
                  <p className="text-sm font-semibold text-base-content">Hundreds more listings inside</p>
                  <Link
                    to="/signup"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-primary/90"
                  >
                    Sign up to browse everything <ArrowRight className="size-4" />
                  </Link>
                  <p className="text-xs text-base-content/50">
                    Already a member? <Link to="/login" className="font-semibold text-primary">Log in</Link>
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-base-200 bg-base-200/40">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center">
          <h3 className="text-xl font-bold text-base-content">Ready to look properly?</h3>
          <p className="mt-2 text-sm text-base-content/60">
            Save searches, set price alerts, message owners, and track your deal end to end — free.
          </p>
          <Link
            to="/signup"
            className="mt-5 inline-block rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
          >
            Create your account
          </Link>
        </div>
        <p className="pb-8 text-center text-xs text-base-content/40">
          NearMySpace — verified owners, no brokers.
        </p>
      </section>
    </div>
  );
}
