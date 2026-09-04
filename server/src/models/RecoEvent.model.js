import mongoose from "mongoose";

// Every recommendation shown ("impression") and every action on one
// ("click"/"save"/"dismiss"/…), with a snapshot of the sub-scores that
// surfaced it. This is the raw material for tuning FEED_SCORE_WEIGHTS against
// real behaviour instead of guessing — a weekly job joins impressions to
// outcomes and refits the weights. Rows expire after 120 days.

const EVENTS = ["impression", "click", "save", "like", "visit_request", "offer", "dismiss"];

const recoEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    post: { type: mongoose.Schema.Types.ObjectId, ref: "PropertyPost", required: true },
    event: { type: String, enum: EVENTS, required: true },
    position: { type: Number, default: null }, // slot in the list when shown
    strategy: { type: String, default: "" }, // retrieval strategy (geo:gps, national, …)
    context: { type: String, default: "" }, // "sidebar" | "reco_page" | "feed"
    reason: { type: String, default: "" }, // for dismiss: too_expensive | wrong_area | wrong_type | not_interested
    scores: {
      personalization: Number,
      comment: Number,
      recency: Number,
      popularity: Number,
      final: Number,
    },
  },
  { timestamps: true }
);

recoEventSchema.index({ user: 1, createdAt: -1 });
recoEventSchema.index({ event: 1, createdAt: -1 });
recoEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 120 * 24 * 60 * 60 });

export const RECO_EVENTS = EVENTS;
const RecoEvent = mongoose.model("RecoEvent", recoEventSchema);
export default RecoEvent;
