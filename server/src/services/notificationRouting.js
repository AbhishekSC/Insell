// Central place that turns a Notification `type` + its structured data
// (the same ObjectId fields already stored on the Notification document —
// propertyPost, circle, offer, deal, visitRequest, callId, etc.) into the
// web client's in-app route.
//
// This exists so call sites never hardcode a web URL string into a
// notification's `data` — that string was leaking into the FCM push
// `data` payload verbatim, which is fine for the web client (its service
// worker reads `data.url` to navigate on click) but meaningless to a
// mobile client, which needs to route on its own native stack instead.
// `NotificationService.send()` calls `deriveWebPath()` once, right before
// building the *web* push payload specifically, and never puts the result
// in the platform-neutral payload sent to iOS/Android tokens — those get
// `{ type, ...data }` and derive their own route from `type` + the ids.
export function deriveWebPath(type, data = {}) {
  switch (type) {
    case "property_like":
    case "property_save":
    case "comment":
    case "price_drop":
    case "offer_price_changed":
    case "offer_received":
    case "offer_countered":
    case "offer_accepted":
    case "offer_declined":
    case "visit_requested":
    case "visit_confirmed":
    case "visit_rescheduled":
    case "visit_declined":
    case "visit_cancelled":
    case "deal_updated":
    case "deal_completed":
    case "deal_cancelled":
    case "post_blocked":
    case "post_unblocked":
    case "post_reported":
    case "post_report_resolved":
      return data.propertyPost ? `/property/${data.propertyPost}` : undefined;

    case "review_received":
      // The recipient IS the reviewee — this links to their own profile,
      // not to any id carried in `data`.
      return "/profile";

    case "circle_invite":
    case "circle_join_request":
    case "circle_join_request_result":
    case "circle_deleted":
    case "circle_member_add_request":
    case "circle_member_add_request_result":
    case "circle_member_joined":
    case "circle_member_left":
    case "circle_call_started":
      return "/marketplace?section=communities";

    case "circle_call_scheduled":
    case "circle_call_reminder": {
      if (!data.circle) return "/marketplace?section=communities";
      const params = new URLSearchParams({ section: "communities", circle: String(data.circle), joinCall: "1" });
      if (data.callId) params.set("callId", String(data.callId));
      return `/marketplace?${params.toString()}`;
    }

    default:
      return undefined;
  }
}
