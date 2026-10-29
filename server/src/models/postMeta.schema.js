import mongoose from "mongoose";

// Typed replacement for the old `postMeta: Mixed` field on PropertyPost.
//
// Deliberate choices:
//  - `strict: false` on every sub-schema and the container: unknown keys are
//    kept, not dropped. Some read paths (the client's buildPropertyDetailBadges,
//    PersonalizationService's postMeta.amenities) reference ad-hoc keys that no
//    writer sets yet — this keeps that door open and keeps any seed/demo data
//    intact.
//  - No `enum` validators in v1. Older documents may hold slightly different
//    strings (e.g. "Semi Furnished" vs "Semi-Furnished"); an enum would make
//    those throw on the next save. Types only for now.
//  - `_id: false`: these are plain embedded objects, not sub-documents.
//  - `default: () => ({})` on each branch so `post.postMeta.land` etc. is
//    always a readable object. Mongoose's default `minimize: true` still drops
//    the branches that stay empty when the document is saved, so stored docs
//    don't grow.
//
// What this buys us over Mixed: numbers/booleans in these branches are cast on
// write ("5" -> 5), and in-place edits no longer need markModified().

const subOpts = { _id: false, strict: false, minimize: false };

const RequirementMetaSchema = new mongoose.Schema(
  {
    budgetMin: Number,
    budgetMax: Number,
    moveInDate: String,
    availableFromDate: String,
    leaseDurationMonths: Number,
    depositAmount: Number,
    requirementPropertyType: String,
    furnishedPreference: String,
    occupancyPreference: String,
    genderPreference: String,
    parkingRequired: Boolean,
    loanRequired: Boolean,
    amenitiesText: String,
    possessionDate: String,
    tenantType: String,
    occupation: mongoose.Schema.Types.Mixed,
  },
  subOpts
);

const LandMetaSchema = new mongoose.Schema(
  {
    landArea: { type: Number, min: 0 },
    landAreaUnit: String,
    soilType: String,
    waterAvailability: String,
    roadAccess: Boolean,
    electricityAvailable: Boolean,
  },
  subOpts
);

const CommercialMetaSchema = new mongoose.Schema(
  {
    commercialType: String,
    carpetArea: { type: Number, min: 0 },
    floorNumber: Number,
    washrooms: { type: Number, min: 0 },
  },
  subOpts
);

const ProjectMetaSchema = new mongoose.Schema(
  {
    projectName: String,
    launchDate: String,
    reraNumber: String,
    brochureUrl: String,
  },
  subOpts
);

const InvestmentMetaSchema = new mongoose.Schema(
  {
    thesis: String,
  },
  subOpts
);

export const ELECTRICITY_BILL_STATUS = {
  NONE: "NONE",
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
};

const ResidentialMetaSchema = new mongoose.Schema(
  {
    furnishing: String,
    facing: String,
    floorNumber: Number,
    totalFloors: Number,
    ageOfProperty: String,
    maintenanceCharges: Number,
    houseRules: mongoose.Schema.Types.Mixed,
    spaceType: String,
    preferredTenants: [String],
    alternativeMobile: String,
    electricityBillUrl: String,
    electricityBillStatus: {
      type: String,
      enum: ["NONE", "PENDING", "VERIFIED", "REJECTED"],
      default: "NONE",
    },
    electricityBillVerifiedAt: Date,
    electricityBillVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    electricityBillRejectionReason: String,
    electricityBillVerificationNote: String,
  },
  subOpts
);

const FlatmateMetaSchema = new mongoose.Schema(
  {
    roomType: String,
    occupancy: Number,
    rentPerPerson: Number,
    depositAmount: Number,
    availableFrom: String,
    furnishing: String,
    genderPreference: String,
    targetAudience: [String],
    lifestyleTags: [String],
    amenityTags: [String],
    collegeName: String,
    workplaceName: String,
    budgetMin: Number,
    budgetMax: Number,
    preferredLocalities: [String],
    groupSize: Number,
    occupation: [String],
    hideContact: { type: Boolean, default: false },
  },
  subOpts
);

export const PostMetaSchema = new mongoose.Schema(
  {
    requirement: { type: RequirementMetaSchema, default: () => ({}) },
    land: { type: LandMetaSchema, default: () => ({}) },
    commercial: { type: CommercialMetaSchema, default: () => ({}) },
    project: { type: ProjectMetaSchema, default: () => ({}) },
    investment: { type: InvestmentMetaSchema, default: () => ({}) },
    residential: { type: ResidentialMetaSchema, default: () => ({}) },
    flatmate: { type: FlatmateMetaSchema, default: () => ({}) },
    amenities: { type: [String], default: undefined },
  },
  { _id: false, strict: false, minimize: true }
);
