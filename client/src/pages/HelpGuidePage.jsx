import { useState } from "react";
import { X, Home, PlusCircle, HandCoins, MessageCircle, Map, Bell, Flag } from "lucide-react";
import AppShell from "../components/AppShell";
import helpMarketplace from "../assets/help/help-marketplace.jpg";
import helpCreatePost from "../assets/help/help-create-post.jpg";
import helpPropertyDetail from "../assets/help/help-property-detail.jpg";
import helpChat from "../assets/help/help-chat.jpg";
import helpMapView from "../assets/help/help-map-view.jpg";
import helpNotifications from "../assets/help/help-notifications.jpg";

const SECTIONS = [
  {
    icon: Home,
    title: "Browse the Marketplace",
    summary: "Discover listings from sellers, landlords, and brokers near you.",
    steps: [
      'Open "Marketplace" from the left navigation or the bottom nav on mobile.',
      'Use "For You", "Following", "Near Me" and category tabs to switch feeds.',
      "Tap Filters to narrow results by price, property type, and location.",
      "Tap any listing card to open its full details.",
    ],
    screenshot: helpMarketplace,
  },
  {
    icon: PlusCircle,
    title: "Post a Property",
    summary: "List a property for sale or rent, or post what you're looking for.",
    steps: [
      'Tap the "Create Post" button in the header.',
      "Choose the post type — sale, rent, requirement, commercial, and more.",
      "Fill in photos, price, and location across the guided steps.",
      "Submit — your post appears in the marketplace feed instantly.",
    ],
    screenshot: helpCreatePost,
  },
  {
    icon: HandCoins,
    title: "Make an Offer & Negotiate",
    summary: "Send a price offer directly from a listing and negotiate with the owner.",
    steps: [
      "Open a property's detail page and tap Make an Offer.",
      "Enter your price and an optional message, then submit.",
      "The owner can accept, decline, or counter your offer.",
      "Once accepted, you can leave a review for each other and the listing is marked Sold/Rented.",
    ],
    screenshot: helpPropertyDetail,
  },
  {
    icon: MessageCircle,
    title: "Chat & Connections",
    summary: "Message property owners and other users once you're connected.",
    steps: [
      "Send a Connect request from a user's profile or a property page.",
      "Once accepted, open Messages to start chatting in real time.",
      "Accepting an offer automatically connects buyer and owner as friends.",
    ],
    screenshot: helpChat,
  },
  {
    icon: Map,
    title: "Explore Map View",
    summary: "See every listing plotted on a map and check nearby amenities.",
    steps: [
      'Open "Map View" from the navigation.',
      "Tap a price pin to preview that listing — the selected pin highlights.",
      "On desktop, see nearby schools, hospitals, and transit for the selected property.",
    ],
    screenshot: helpMapView,
  },
  {
    icon: Bell,
    title: "Notifications",
    summary: "Stay on top of offers, messages, and price changes.",
    steps: [
      "Tap the bell icon to open your notifications.",
      "Accept/decline offers or leave a review directly from a notification.",
      "Tap any notification to jump straight to the related property or user.",
    ],
    screenshot: helpNotifications,
  },
  {
    icon: Flag,
    title: "Report an Issue",
    summary: "Ran into a bug or have feedback? Let us know directly from the app.",
    steps: [
      "Open the menu (☰ on mobile, your profile menu on desktop).",
      'Tap "Report Issue".',
      "Describe what happened and optionally attach a screenshot, then send.",
      "Our team reviews every submission from the admin dashboard.",
    ],
  },
];

function ScreenshotLightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
        <X className="size-5" />
      </button>
      <img src={src} alt="App screenshot" className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl" />
    </div>
  );
}

export default function HelpGuidePage() {
  const [lightbox, setLightbox] = useState(null);

  return (
    <AppShell hideHero title="How to use NearMySpace" subtitle="A quick walkthrough of everything you can do in the app">
      <div className="mx-auto max-w-3xl px-4 py-6 pb-24">
        <div className="mb-6 flex items-center gap-4 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-5 text-white shadow-sm">
          <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/15">
            <Home className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold">New here? Start with the basics</p>
            <p className="text-sm text-white/80">Browse, post, negotiate, and chat — all in one place.</p>
          </div>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start gap-3 p-5">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-800">{section.title}</h3>
                    <p className="mt-0.5 text-sm text-slate-500">{section.summary}</p>
                    <ol className="mt-3 space-y-1.5">
                      {section.steps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-sm text-slate-700">
                          <span className="shrink-0 font-semibold text-indigo-600">{i + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
                {section.screenshot && (
                  <button
                    type="button"
                    onClick={() => setLightbox(section.screenshot)}
                    className="block w-full border-t border-slate-100 bg-slate-50 px-5 py-4"
                  >
                    <img
                      src={section.screenshot}
                      alt={`${section.title} screenshot`}
                      className="mx-auto max-h-56 rounded-lg border border-slate-200 object-contain shadow-sm hover:opacity-90"
                    />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <ScreenshotLightbox src={lightbox} onClose={() => setLightbox(null)} />
    </AppShell>
  );
}
