import mongoose from "mongoose";

// Picks up where the Offer flow ends. An accepted offer creates a Deal, and
// the two parties walk it through the closing stages in-app instead of
// vanishing to WhatsApp. Stages are turn-based: one party proposes a step
// done, the other confirms (or disputes). Every mutation is atomic and
// idempotent (per-request UUID replay guard), mirroring the Offer flow.

export const DEAL_STAGES = {
  BUY: [
    { key: "agreed", label: "Agreed", hint: "Price locked in" },
    { key: "documents", label: "Documents", hint: "ID, title deed, NOC — shared & verified" },
    { key: "agreement", label: "Agreement", hint: "Sale agreement drafted & signed" },
    { key: "payment", label: "Payment", hint: "Token or full payment made" },
    { key: "registration", label: "Registration", hint: "Registered at the sub-registrar" },
    { key: "completed", label: "Completed", hint: "Keys handed over" },
  ],
  RENT: [
    { key: "agreed", label: "Agreed", hint: "Rent locked in" },
    { key: "documents", label: "Documents", hint: "ID, employment proof — shared & verified" },
    { key: "agreement", label: "Rent agreement", hint: "Drafted & signed" },
    { key: "payment", label: "Deposit + first month", hint: "Paid" },
    { key: "completed", label: "Move-in", hint: "Keys handed over" },
  ],
};

export const DEAL_STAGE_KEYS = [...new Set(Object.values(DEAL_STAGES).flat().map((s) => s.key))];
const DEAL_HISTORY_ACTIONS = [
  "create", "propose", "confirm", "dispute", "revert", "note", "attach",
  "cancel_request", "cancel_confirm", "cancel", "complete", "report",
];

const dealSchema = new mongoose.Schema(
  {
    post: { type: mongoose.Schema.Types.ObjectId, ref: "PropertyPost", required: true, index: true },
    // One deal per accepted offer.
    offer: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", required: true, unique: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    agreedPrice: { type: Number, required: true, min: 0 },
    mode: { type: String, enum: ["BUY", "RENT"], required: true },

    status: { type: String, enum: ["ACTIVE", "COMPLETED", "CANCELLED"], default: "ACTIVE", index: true },
    // A running signal when the two parties disagree on a stage. Not a hard
    // block — just visible to them and to admin.
    disputed: { type: Boolean, default: false },
    disputeCounts: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },

    currentStage: { type: String, enum: DEAL_STAGE_KEYS, default: "agreed" },
    completedStages: { type: [String], default: ["agreed"] },

    // A stage one party has marked done, waiting on the other to confirm.
    pendingStage: {
      type: {
        key: { type: String, required: true },
        proposedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        proposedAt: { type: Date, default: Date.now },
        message: { type: String, trim: true, maxlength: 500, default: "" },
        amount: { type: Number, default: null }, // rupees, for the payment stage
      },
      default: null,
    },

    // Once payment is confirmed, cancelling is no longer unilateral — it's a
    // request the other party has to accept.
    pendingCancel: {
      type: {
        requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, trim: true, maxlength: 500, default: "" },
        requestedAt: { type: Date, default: Date.now },
      },
      default: null,
    },

    // Amount actually paid at the payment stage + who confirmed it.
    paymentAmount: { type: Number, default: null },
    paymentConfirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    attachments: [
      {
        url: { type: String, required: true },
        name: { type: String, trim: true, default: "Document" },
        stage: { type: String, default: "" },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    reports: [
      {
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reason: { type: String, trim: true, maxlength: 1000, required: true },
        at: { type: Date, default: Date.now },
        resolved: { type: Boolean, default: false },
      },
    ],

    lastNudgedAt: { type: Date, default: null },

    history: [
      {
        action: { type: String, enum: DEAL_HISTORY_ACTIONS, required: true },
        stage: { type: String, default: "" },
        message: { type: String, trim: true, maxlength: 500, default: "" },
        by: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        at: { type: Date, default: Date.now },
        // Client-generated per-attempt UUID — a retried PATCH carrying a
        // requestId already in history is a replay, not a new action. No
        // schema default (see the identical note in Offer.model.js) so the
        // sparse-unique index only sees genuinely-present values.
        requestId: { type: String },
      },
    ],

    cancelledReason: { type: String, trim: true, maxlength: 500, default: "" },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dealSchema.index({ buyer: 1, status: 1, updatedAt: -1 });
dealSchema.index({ owner: 1, status: 1, updatedAt: -1 });
dealSchema.index({ disputed: 1, status: 1 });
// Concurrency-safe idempotency, exactly as Offer does it.
dealSchema.index({ "history.requestId": 1 }, { unique: true, sparse: true });

const Deal = mongoose.model("Deal", dealSchema);
export default Deal;
