import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    type: {
      type: String,
      required: true,
      default: "session_invite",
      index: true,
      enum: [
        "session_invite",
        "property_contact",
        "message_request",
        "property_like",
        "property_save",
        "comment",
        "follow",
        "circle_invite",
        "circle_join_request",
        "circle_join_request_result",
        "circle_deleted",
        "circle_member_add_request",
        "circle_member_add_request_result",
        "circle_member_joined",
        "circle_member_left",
        "circle_call_started",
        "post_blocked",
        "post_unblocked",
        "post_reported",
        "post_report_resolved",
        "admin_announcement",
        "price_drop",
        "offer_price_changed",
        "offer_received",
        "offer_countered",
        "offer_accepted",
        "offer_declined",
        "review_received",
        "visit_requested",
        "visit_confirmed",
        "visit_rescheduled",
        "visit_declined",
        "visit_cancelled",
      ],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    actualMessage: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    // Optional image on admin_announcement notifications.
    image: {
      type: String,
      trim: true,
    },
    // Structured before/after numbers for price_drop notifications — lets
    // the client render a clear "₹X → ₹Y" line instead of having to parse
    // the human-readable message sentence for the two figures.
    priceBefore: {
      type: Number,
    },
    priceAfter: {
      type: Number,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
    },
    circle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudyCircle",
    },
    // Property-related fields
    propertyPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PropertyPost",
    },
    offer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
    visitRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "VisitRequest",
    },
    // Message request fields
    messageRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },
    requestStatus: {
      type: String,
      enum: ["pending", "accepted", "ignored", "blocked"],
      default: "pending",
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, type: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;
