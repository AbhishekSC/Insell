import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { SCHEMA_CONSTANTS } from "../utils/constants.js";
import { logger } from "../utils/logger.js";

// **Constants**: Destructure constants for schema validation
const {
  PASSWORD_MIN_LENGTH,
  BCRYPT_SALT_ROUNDS,
  MAX_STRING_LENGTH,
  MAX_FULL_NAME_LENGTH,
} = SCHEMA_CONSTANTS;

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Username is required"],
      trim: true,
      maxlength: [
        MAX_FULL_NAME_LENGTH,
        `Full name cannot exceed ${MAX_FULL_NAME_LENGTH} characters`,
      ],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: PASSWORD_MIN_LENGTH,
      select: false, // Exclude password from queries by default
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [
        MAX_STRING_LENGTH,
        `Bio cannot exceed ${MAX_STRING_LENGTH} characters`,
      ],
    },
    profilePic: {
      type: String,
      default: "",
    },
    nativeLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    learningLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      trim: true,
      default: "",
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

// **Indexes**: Create indexes for email and fullName for faster queries
userSchema.index({ fullName: 1 });

// **Pre Hooks(Middlewares)**: For password hashing
userSchema.pre("save", async function (next) {
  try {
    if (!this.isModified("password")) {
      return next();
    }
    const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);

    next();
  } catch (error) {
    logger.error("Error hashing password:", error);
    next(new Error("Failed to hash password"));
  }
});

// **Methods**
userSchema.methods.verifyCredentials = async function (password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (error) {
    logger.error("Error verifying credentials:", error);
    throw new Error("Failed to verify credentials");
  }
};

const User = mongoose.model("User", userSchema);

export default User;
