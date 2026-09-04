import axiosInstance from "./axios";

// Fire-and-forget recommendation telemetry. Impressions/clicks are batched
// (one request every few seconds); a "dismiss" flushes immediately because it
// has an instant side effect server-side (the post gets suppressed).

let queue = [];
let timer = null;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);
  axiosInstance
    .post("/personalization/events", { events: batch }, { skipErrorToast: true })
    .catch(() => {
      /* telemetry is best-effort */
    });
}

export function trackRecoEvent(evt) {
  if (!evt?.post || !evt?.event) return;
  queue.push(evt);
  if (evt.event === "dismiss" || queue.length >= 25) {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    flush();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, 4000);
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) flush();
  });
}
