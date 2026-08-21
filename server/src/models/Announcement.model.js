import mongoose from "mongoose";

// One row per broadcast sent from the admin panel — the actual per-user
// delivery lives in the Notification collection (type: "admin_announcement").
// This is just the history/audit record: what was sent, to whom, by whom.
const announcementSchema = new mongoose.Schema(
  {
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    image: {
      type: String,
      trim: true,
    },
    segment: {
      role: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      verifiedOnly: { type: Boolean, default: false },
    },
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipientCount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });

const Announcement = mongoose.model("Announcement", announcementSchema);

export default Announcement;
