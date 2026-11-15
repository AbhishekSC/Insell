import mongoose from "mongoose";

const districtCrimeDataSchema = new mongoose.Schema(
  {
    year: { type: Number, required: true, index: true },
    stateName: { type: String, required: true, index: true },
    districtName: { type: String, required: true, index: true },
    stateNormalized: { type: String, required: true, index: true },
    districtNormalized: { type: String, required: true, index: true },
    crimes: {
      rape: { type: Number, default: 0 },
      kidnappingAndAbduction: { type: Number, default: 0 },
      crueltyByHusband: { type: Number, default: 0 },
      dowryDeaths: { type: Number, default: 0 },
      assaultOnWomen: { type: Number, default: 0 },
      sexualHarassment: { type: Number, default: 0 },
      stalking: { type: Number, default: 0 },
      childRape: { type: Number, default: 0 },
      pocso: { type: Number, default: 0 },
      cyberCrimes: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    population: { type: Number, default: 0 },
    crimeRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

districtCrimeDataSchema.index(
  { districtNormalized: 1, stateNormalized: 1, year: -1 },
  { unique: true }
);

export default mongoose.model("DistrictCrimeData", districtCrimeDataSchema);
