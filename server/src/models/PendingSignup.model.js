import mongoose from "mongoose";

// Holds a signup in progress until its email OTP is verified — no User
// document is created until then (see AuthService.verifySignup). Abandoned
// signups clean themselves up automatically via the TTL index below, so an
// unverified attempt never lingers forever.
const PENDING_SIGNUP_TTL_SECONDS = 24 * 60 * 60; // 24 hours

const pendingSignupSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    // Hashed once here (see AuthService) — never stored as plaintext, even
    // temporarily.
    password: {
      type: String,
      required: true,
    },
    verificationCode: {
      type: String,
      required: true,
    },
    verificationCodeExpires: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

pendingSignupSchema.index({ createdAt: 1 }, { expireAfterSeconds: PENDING_SIGNUP_TTL_SECONDS });

const PendingSignup = mongoose.model("PendingSignup", pendingSignupSchema);

export default PendingSignup;
