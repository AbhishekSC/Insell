import mongoose from "mongoose";

// Deliberately no expiration field/status. An offer left open forever is a
// real product gap, but adding "expired" without first deciding the actual
// semantics — can the other side still counter an expiring offer? does
// expiring notify anyone? is the window fixed or configurable? — would
// mean guessing at business rules no one has actually chosen yet. Add this
// once those questions have real answers, not before.
const offerSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
      required: true,
      index: true,
    },
    buyer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Post's price at the moment the offer was opened — kept even if the
    // owner later edits the listing price, so the negotiation thread stays
    // meaningful ("started at ₹X") regardless of unrelated listing edits.
    listedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    // The price currently on the table — whatever the last proposal was,
    // from either side. What "accept" locks in.
    currentPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "countered", "accepted", "declined", "withdrawn"],
      default: "pending",
      index: true,
    },
    // Who made the currently-outstanding proposal — the other party is the
    // only one allowed to accept it (you can't accept your own offer).
    lastActionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    history: [
      {
        price: { type: Number, required: true },
        message: { type: String, trim: true, maxlength: 500, default: "" },
        actorRole: { type: String, enum: ["buyer", "owner"], required: true },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        action: { type: String, enum: ["offer", "counter", "accept", "decline", "withdraw"], required: true },
        at: { type: Date, default: Date.now },
        // Client-generated per-attempt UUID. A retried request (double
        // click, network timeout + resubmit) carrying a requestId that's
        // already in this history is a replay, not a new action — the
        // controller returns the existing result instead of applying the
        // mutation again, so retries can't create duplicate history
        // entries, notifications, or Stream/friendship side effects.
        //
        // Deliberately no `default` here — a subdocument default would set
        // this to a concrete value (even `null`) on every entry, including
        // the many internal ones (auto-decline on accept, etc.) that never
        // carry a requestId at all. That would make every such entry index
        // identically and break the sparse-unique index below, which only
        // works because the field is truly *absent*, not present-as-null,
        // on entries that don't use it.
        requestId: { type: String },
      },
    ],
  },
  { timestamps: true }
);

offerSchema.index({ post: 1, buyer: 1 });
offerSchema.index({ owner: 1, status: 1, createdAt: -1 });
offerSchema.index({ buyer: 1, status: 1, createdAt: -1 });
// Enforces true concurrency safety for idempotency keys: two requests
// racing with the identical requestId can't both successfully push a
// history entry, even if both pass the application-level replay check
// before either write lands (the classic TOCTOU gap). Sparse + unique
// across the whole collection is safe because requestIds are
// client-generated UUIDs, globally unique by construction.
offerSchema.index({ "history.requestId": 1 }, { unique: true, sparse: true });

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;
