import { describe, it, expect } from "vitest";
import { deriveWebPath } from "../src/services/notificationRouting.js";

describe("deriveWebPath", () => {
  it("derives a property page from propertyPost for property-related types", () => {
    const types = [
      "property_like",
      "property_save",
      "comment",
      "price_drop",
      "offer_price_changed",
      "offer_received",
      "offer_countered",
      "offer_accepted",
      "offer_declined",
      "visit_requested",
      "visit_confirmed",
      "visit_rescheduled",
      "visit_declined",
      "visit_cancelled",
      "deal_updated",
      "deal_completed",
      "deal_cancelled",
      "post_blocked",
      "post_unblocked",
      "post_reported",
      "post_report_resolved",
    ];
    for (const type of types) {
      expect(deriveWebPath(type, { propertyPost: "abc123" })).toBe("/property/abc123");
    }
  });

  it("returns undefined for a property-related type with no propertyPost id", () => {
    expect(deriveWebPath("property_like", {})).toBeUndefined();
  });

  it("sends review_received to the reviewee's own profile regardless of data", () => {
    expect(deriveWebPath("review_received", {})).toBe("/profile");
    expect(deriveWebPath("review_received")).toBe("/profile");
  });

  it("routes plain community notifications to the communities section", () => {
    const types = [
      "circle_invite",
      "circle_join_request",
      "circle_join_request_result",
      "circle_deleted",
      "circle_member_add_request",
      "circle_member_add_request_result",
      "circle_member_joined",
      "circle_member_left",
      "circle_call_started",
    ];
    for (const type of types) {
      expect(deriveWebPath(type, { circle: "c1" })).toBe("/marketplace?section=communities");
    }
  });

  it("adds circle + joinCall=1 for a scheduled-call type, and callId when present", () => {
    expect(deriveWebPath("circle_call_scheduled", { circle: "c1" })).toBe(
      "/marketplace?section=communities&circle=c1&joinCall=1"
    );
    expect(deriveWebPath("circle_call_reminder", { circle: "c1", callId: "call1" })).toBe(
      "/marketplace?section=communities&circle=c1&joinCall=1&callId=call1"
    );
  });

  it("falls back to the communities section for a scheduled-call type with no circle id", () => {
    expect(deriveWebPath("circle_call_scheduled", {})).toBe("/marketplace?section=communities");
  });

  it("returns undefined for an unmapped/unknown type", () => {
    expect(deriveWebPath("something_new", { propertyPost: "abc" })).toBeUndefined();
  });
});
