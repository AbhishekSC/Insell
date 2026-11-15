import mongoose from "mongoose";

export const SUPPORTED_STATES = [
  "maharashtra",
  "karnataka",
  "delhi",
  "tamil_nadu",
  "telangana",
  "uttar_pradesh",
  "rajasthan",
  "gujarat",
  "west_bengal",
  "madhya_pradesh",
  "other",
];

const rentalAgreementSchema = new mongoose.Schema(
  {
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    state: {
      type: String,
      enum: SUPPORTED_STATES,
      required: true,
    },
    tenantName: { type: String, trim: true, required: true, maxlength: 120 },
    tenantAddress: { type: String, trim: true, maxlength: 500, default: "" },
    tenantPhone: { type: String, trim: true, maxlength: 15, default: "" },
    tenantAadhar: { type: String, trim: true, maxlength: 12, default: "" },

    landlordName: { type: String, trim: true, required: true, maxlength: 120 },
    landlordAddress: { type: String, trim: true, maxlength: 500, default: "" },
    landlordPhone: { type: String, trim: true, maxlength: 15, default: "" },
    landlordAadhar: { type: String, trim: true, maxlength: 12, default: "" },

    propertyAddress: { type: String, trim: true, required: true, maxlength: 500 },
    propertyType: { type: String, trim: true, default: "Apartment" },
    furnishing: { type: String, trim: true, default: "" },

    monthlyRent: { type: Number, required: true, min: 1 },
    securityDeposit: { type: Number, default: 0, min: 0 },
    maintenanceCharges: { type: Number, default: 0, min: 0 },
    rentDueDate: { type: Number, min: 1, max: 31, default: 5 },

    leaseStartDate: { type: Date, required: true },
    leaseEndDate: { type: Date, required: true },
    lockInPeriodMonths: { type: Number, default: 0, min: 0 },
    noticePeriodMonths: { type: Number, default: 1, min: 0 },

    additionalTerms: { type: [String], default: undefined },

    pdfUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

rentalAgreementSchema.index({ createdBy: 1, createdAt: -1 });

export default mongoose.model("RentalAgreement", rentalAgreementSchema);
