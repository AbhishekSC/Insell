import mongoose from "mongoose";

// A buyer/tenant asking to tour a property. Modeled on Offer: a small state
// machine with a `lastActionBy` "whose turn is it" pointer and a `history`
// array that drives the timeline card shown in chat / on the listing.
//
// No auto-expiry (same reasoning as Offer) — a stale request just sits in
// PENDING until someone acts on it or cancels.

export const VISIT_STATUSES = [
  "PENDING", // requester proposed slots, waiting on the owner
  "RESCHEDULE_PROPOSED", // one side proposed new slots, waiting on the other
  "CONFIRMED", // a slot is locked in
  "DECLINED", // owner said no
  "CANCELLED", // requester pulled out
  "COMPLETED", // the confirmed slot has passed
];

const visitRequestSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "PropertyPost", required: true, index: true },
    requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    status: { type: String, enum: VISIT_STATUSES, default: "PENDING", index: true },
    mode: { type: String, enum: ["IN_PERSON", "VIDEO"], default: "IN_PERSON" },

    // The slots currently on the table — set by whoever acted last. 1–3 entries.
    proposedSlots: [{ type: Date }],
    // Set only when status is CONFIRMED.
    confirmedSlot: { type: Date, default: null },

    // Whoever made the outstanding proposal — the *other* party is the one
    // who can confirm / counter / decline it.
    lastActionBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    note: { type: String, trim: true, maxlength: 500, default: "" },

    history: [
      {
        action: { type: String, enum: ["request", "propose", "confirm", "decline", "cancel"], required: true },
        actorRole: { type: String, enum: ["requester", "owner"], required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        slots: [{ type: Date }],
        slot: { type: Date, default: null },
        message: { type: String, trim: true, maxlength: 500, default: "" },
        at: { type: Date, default: Date.now },
        // Client per-attempt UUID — a retried submit carrying a requestId
        // already present here is a replay, not a new action.
        requestId: { type: String },
      },
    ],
  },
  { timestamps: true }
);

visitRequestSchema.index({ post: 1, requester: 1 });
visitRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
visitRequestSchema.index({ requester: 1, status: 1, createdAt: -1 });
visitRequestSchema.index({ "history.requestId": 1 }, { unique: true, sparse: true });

const VisitRequest = mongoose.model("VisitRequest", visitRequestSchema);
export default VisitRequest;
