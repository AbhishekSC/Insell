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
        "post_blocked",
        "post_unblocked",
        "post_reported",
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
