import { toast } from "react-hot-toast";
import ToastCard from "../components/ToastCard.jsx";

// ---------------------------------------------------------------------------
// Turns a raw error (usually an axios error) into a short notice and renders
// it as a compact card (ToastCard). Copy style: one tight title + at most
// one short supporting line. Recovery lives in the action button, not prose.
//   kind          visual style + icon
//   title         3–5 words — what went wrong
//   message       one short line (optional)
//   ref           short code the user can quote to support
//   retryAfterMs  cooldown before retry is allowed (rate limits)
//   secondary     optional { label, onClick } (Sign in, Get help…)
//   meta          { method, url, status } for the "Details" panel
// Identical failures collapse into one card (dedupeKey).
// ---------------------------------------------------------------------------

let refCounter = Math.floor(Math.random() * 0xffff);
function nextRef() {
  refCounter = (refCounter + 1) % 0x10000;
  return `ERR-${refCounter.toString(16).toUpperCase().padStart(4, "0")}`;
}

function metaOf(error) {
  const cfg = error?.config || {};
  return {
    method: cfg.method ? cfg.method.toUpperCase() : undefined,
    url: cfg.url ? cfg.url.replace(/([?&])(token|auth)=[^&]*/gi, "$1$2=…") : undefined,
    status: error?.response?.status,
  };
}

const HELP = { label: "Get help", onClick: () => window.location.assign("/help") };
const SIGN_IN = { label: "Sign in", onClick: () => window.location.assign("/login") };

export function describeError(error) {
  const status = error?.response?.status;
  const data = error?.response?.data || {};
  const serverMessage = typeof data.message === "string" ? data.message.trim() : "";
  const code = data.code || data.missingFields?.code;
  const base = { ref: nextRef(), meta: metaOf(error) };

  const retryHeader = Number(error?.response?.headers?.["retry-after"]);
  const retryAfterMs = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader * 1000 : 0;

  // No response — network / server unreachable.
  if (error && !error.response) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { ...base, kind: "offline", title: "You're offline", message: "Check your connection.", dedupeKey: "offline" };
    }
    if (error.code === "ECONNABORTED") {
      return { ...base, kind: "offline", title: "Request timed out", dedupeKey: "timeout" };
    }
    return { ...base, kind: "offline", title: "Can't reach the server", dedupeKey: "unreachable" };
  }

  if (code === "ACCOUNT_BLOCKED") {
    return { ...base, kind: "blocked", title: "Account restricted", message: serverMessage || "Contact support for help.", secondary: HELP, dedupeKey: "account-blocked" };
  }
  if (code === "VISIT_LIMIT_REACHED") {
    return { ...base, kind: "rate", title: "Visit limit reached", message: serverMessage || "Try again later.", dedupeKey: "visit-limit" };
  }

  if (status === 429) {
    return { ...base, kind: "rate", title: "Too many requests", message: "Wait a moment.", retryAfterMs: retryAfterMs || 8000, dedupeKey: "rate-limit" };
  }
  if (status === 401) {
    return { ...base, kind: "warning", title: "Session expired", message: "Sign in to continue.", secondary: SIGN_IN, dedupeKey: "session-expired" };
  }
  if (status === 403) {
    return { ...base, kind: "warning", title: "Not allowed", message: serverMessage || "You don't have access to this." };
  }
  if (status === 404) {
    return { ...base, kind: "warning", title: "Not found", message: serverMessage || "This item no longer exists." };
  }
  if (status === 409) {
    return { ...base, kind: "warning", title: "Couldn't complete that", message: serverMessage || "Refresh and try again." };
  }
  if (status === 400 || status === 422) {
    return { ...base, kind: "warning", title: "Check your details", message: serverMessage || "Some fields need fixing." };
  }
  if (status >= 500) {
    return { ...base, kind: "error", title: "Something went wrong", message: "That's on us. Try again shortly.", secondary: HELP, retryAfterMs, dedupeKey: `server-${status}` };
  }

  return { ...base, kind: "error", title: "Something went wrong", message: serverMessage || "Please try again." };
}

// We reuse a stable toast id per error kind so a flood of the same failure
// collapses into one card. The catch: react-hot-toast resets a toast's
// auto-dismiss timer every time it's re-fired with the same id — so a
// polling request that keeps failing would pin the toast open forever.
// Fix: own the dismissal ourselves, scheduled once from the FIRST sighting.
const dismissTimers = new Map();
function scheduleDismiss(id, duration) {
  if (dismissTimers.has(id) || !Number.isFinite(duration)) return;
  const timer = setTimeout(() => {
    toast.dismiss(id);
    dismissTimers.delete(id);
  }, duration);
  dismissTimers.set(id, timer);
}
function clearDismiss(id) {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }
}

// Auto-retry is only safe for reads — a failed GET can be re-run; mutations
// must be retried by the user's own action so we never double-submit.
function safeRetry(error) {
  const method = (error?.config?.method || "get").toLowerCase();
  if (method !== "get" || !error?.config) return undefined;
  return async () => {
    const { default: axiosInstance } = await import("./axios.js");
    await axiosInstance.request({ ...error.config, skipErrorToast: true });
  };
}

export function showError(error, { onRetry } = {}) {
  const info = describeError(error);
  const retry =
    onRetry || (["offline", "rate", "error"].includes(info.kind) ? safeRetry(error) : undefined);
  const duration = info.kind === "offline" || info.kind === "rate" ? 7000 : 5000;
  const id = `err:${info.dedupeKey || info.title}`;
  // Infinity here disables react-hot-toast's own (resettable) timer;
  // scheduleDismiss gives every card a fixed lifespan from first sight.
  toast.custom(
    (t) => <ToastCard t={t} info={info} duration={duration} onRetry={retry} onDismissed={() => clearDismiss(id)} />,
    { id, duration: Infinity },
  );
  scheduleDismiss(id, duration);
  return info;
}

export function showToast(kind, title, message, opts = {}) {
  const info = { kind, title, message, secondary: opts.secondary };
  const id = `note:${title}`;
  toast.custom(
    (t) => <ToastCard t={t} info={info} duration={4000} onDismissed={() => clearDismiss(id)} />,
    { id, duration: Infinity },
  );
  scheduleDismiss(id, 4000);
}

export const notify = {
  error: (err, opts) => showError(err, opts),
  warning: (title, message, opts) => showToast("warning", title, message, opts),
  info: (title, message, opts) => showToast("info", title, message, opts),
};
