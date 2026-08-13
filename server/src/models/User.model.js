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
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationCode: {
      type: String,
      select: false, // Exclude from queries by default
    },
    verificationCodeExpires: {
      type: Date,
      select: false,
    },
    resetOTP: {
      type: String,
      select: false, // Exclude from queries by default
    },
    resetOTPExpires: {
      type: Date,
      select: false,
    },
    password: {
      type: String,
      required: function() {
        // Password is required only if not using OAuth
        return !this.googleId;
      },
      minlength: PASSWORD_MIN_LENGTH,
      select: false, // Exclude password from queries by default
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows multiple null values
      select: false,
    },
    provider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
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
    mobileNumber: {
      type: String,
      trim: true,
      default: "",
    },
    preferredLanguage: {
      type: String,
      trim: true,
      default: "",
    },
    primaryRole: {
      type: String,
      trim: true,
      default: "",
    },
    activeRole: {
      type: String,
      trim: true,
      default: "",
    },
    userRoles: [
      {
        type: String,
        trim: true,
      },
    ],
    city: {
      type: String,
      trim: true,
      default: "",
    },
    preferredLocalities: [
      {
        type: String,
        trim: true,
      },
    ],
    propertyTypePreferences: [
      {
        type: String,
        trim: true,
      },
    ],
    budgetMin: {
      type: Number,
      default: 0,
      min: 0,
    },
    budgetMax: {
      type: Number,
      default: 0,
      min: 0,
    },
    listingIntent: {
      type: String,
      trim: true,
      default: "",
    },
    roleProfiles: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
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
    homeBase: {
      type: String,
      trim: true,
      default: "",
    },
    travelStyle: {
      type: String,
      trim: true,
      default: "",
    },
    travelInterests: [
      {
        type: String,
        trim: true,
      },
    ],
    favoriteDestinations: [
      {
        type: String,
        trim: true,
      },
    ],
    location: {
      type: String,
      trim: true,
      default: "",
    },
    locationDetails: {
      type: {
        latitude: Number,
        longitude: Number,
        country: String,
        countryCode: String,
        city: String,
        state: String,
        address: String,
        formattedAddress: String,
      },
      default: null,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    profileCompletion: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    responseRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyPost",
      },
    ],
    savedPosts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PropertyPost",
      },
    ],
    viewedPosts: [
      {
        post: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PropertyPost",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
        duration: {
          type: Number,
          default: 0, // seconds spent viewing
        },
      },
    ],
    searchHistory: [
      {
        query: {
          type: String,
          trim: true,
        },
        searchedAt: {
          type: Date,
          default: Date.now,
        },
        resultCount: {
          type: Number,
          default: 0,
        },
      },
    ],
    commentAnalytics: {
      totalComments: {
        type: Number,
        default: 0,
        min: 0,
      },
      avgCommentLength: {
        type: Number,
        default: 0,
        min: 0,
      },
      commonKeywords: [
        {
          type: String,
          trim: true,
        },
      ],
      sentimentDistribution: {
        positive: {
          type: Number,
          default: 0,
          min: 0,
        },
        neutral: {
          type: Number,
          default: 0,
          min: 0,
        },
        negative: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
      interestCategories: [
        {
          type: String,
          trim: true,
        },
      ],
      detectedIntents: [
        {
          type: String,
          trim: true,
        },
      ],
      propertyTypeInterests: [
        {
          type: {
            type: String,
            trim: true,
          },
          frequency: {
            type: Number,
            default: 1,
            min: 1,
          },
          lastMentioned: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      lastCommentAt: {
        type: Date,
        default: null,
      },
    },
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
