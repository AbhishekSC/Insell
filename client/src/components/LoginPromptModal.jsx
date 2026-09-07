import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { X } from "lucide-react";

const COPY = {
  post: (name) => ({ title: "See this listing", body: `Sign up or log in to see ${name}'s listing.` }),
  posts: (name) => ({ title: "See all listings", body: `Sign up or log in to see everything ${name} has posted.` }),
  connections: (name) => ({ title: "See connections", body: `Sign up or log in to see who ${name} is connected with.` }),
  follow: (name) => ({ title: "Follow on NearMySpace", body: `Sign up or log in to connect with ${name}.` }),
  contact: (name) => ({ title: "Contact the owner", body: `Sign up or log in to message ${name} about this property.` }),
  offer: () => ({ title: "Make an offer", body: "Sign up or log in to send the owner an offer." }),
  save: () => ({ title: "Save this listing", body: "Sign up or log in to save properties and get price alerts." }),
  visit: () => ({ title: "Request a visit", body: "Sign up or log in to schedule a visit with the owner." }),
  default: () => ({ title: "Join NearMySpace", body: "Sign up or log in to continue." }),
};

// Instagram-style soft wall for logged-out visitors on a shared profile.
export default function LoginPromptModal({ open, onClose, context = "default", name = "this member", avatar }) {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const { title, body } = (COPY[context] || COPY.default)(name);
  const next = encodeURIComponent(location.pathname + location.search);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-base-100 p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-base-content/50 hover:bg-base-200"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        {avatar && (
          <img src={avatar} alt="" className="mx-auto -mt-2 size-14 rounded-full object-cover" />
        )}
        <h3 className="mt-3 text-lg font-bold text-base-content">{title}</h3>
        <p className="mt-1 text-sm text-base-content/60">
          {body} By continuing, you agree to NearMySpace's Terms and Privacy Policy.
        </p>

        <button
          type="button"
          onClick={() => navigate(`/signup?next=${next}`)}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white hover:bg-primary"
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={() => navigate(`/login?next=${next}`)}
          className="mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5"
        >
          Log in
        </button>
      </div>
    </div>
  );
}
