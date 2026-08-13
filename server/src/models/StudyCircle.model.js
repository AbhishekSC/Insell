import mongoose from "mongoose";

const studyCircleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    topic: {
      type: String,
      trim: true,
      required: true,
      maxlength: 160,
    },
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    moderators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingInvites: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pendingJoinRequests: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    memberAddRequests: [
      {
        targetUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        requestedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

studyCircleSchema.index({ members: 1, createdAt: -1 });
studyCircleSchema.index({ moderators: 1, createdAt: -1 });
studyCircleSchema.index({ pendingInvites: 1, createdAt: -1 });
studyCircleSchema.index({ pendingJoinRequests: 1, createdAt: -1 });
studyCircleSchema.index({ "memberAddRequests.targetUser": 1 });

const StudyCircle = mongoose.model("StudyCircle", studyCircleSchema);

export default StudyCircle;
