import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongoDB } from "../src/config/db.config.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import User from "../src/models/User.model.js";
import PGResidency from "../src/models/PGResidency.model.js";
import PGBill from "../src/models/PGBill.model.js";
import IssueReport from "../src/models/IssueReport.model.js";
import MealRating from "../src/models/MealRating.model.js";
import PGReview from "../src/models/PGReview.model.js";

const HANU_ID = "6a59ca4a9a10d4addc642fe7";

async function main() {
  await connectToMongoDB();
  console.log("Connected to MongoDB");

  const hanu = await User.findById(HANU_ID).lean();
  if (!hanu) {
    console.error("Hanu user not found");
    process.exit(1);
  }
  console.log(`Using user: ${hanu.fullName} (${hanu._id})`);

  // Clean up previous seed data
  const existingPg = await PropertyPost.findOne({ postType: "PG_HOSTEL", author: HANU_ID });
  if (existingPg) {
    console.log("Cleaning up previous PG seed data...");
    await Promise.all([
      PropertyPost.deleteMany({ postType: "PG_HOSTEL", author: HANU_ID }),
      PGResidency.deleteMany({ tenant: HANU_ID }),
      PGBill.deleteMany({ tenant: HANU_ID }),
      IssueReport.deleteMany({ reporter: HANU_ID }),
      MealRating.deleteMany({ rater: HANU_ID }),
      PGReview.deleteMany({ reviewer: HANU_ID }),
    ]);
  }

  // ─── 1. PG Post owned by Hanu (for PG Dashboard) ────────────────────
  const ownedPg = await PropertyPost.create({
    author: HANU_ID,
    authorRole: "PG_OWNER",
    postType: "PG_HOSTEL",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    listingType: "PG/Hostel",
    propertyType: "PG",
    title: "Sunshine PG for Men – Koramangala",
    caption:
      "Fully furnished PG in the heart of Koramangala, 5 min walk from Forum Mall. " +
      "Homestyle veg food included, high-speed WiFi (100 Mbps), 24/7 power backup, " +
      "CCTV security, and daily housekeeping. Ideal for working professionals and students.",
    city: "Bangalore",
    locality: "Koramangala",
    latitude: 12.9352,
    longitude: 77.6245,
    location: { type: "Point", coordinates: [77.6245, 12.9352] },
    locationPrecision: "exact",
    price: 6000,
    priceHistory: [{ price: 6000, changedAt: new Date() }],
    bedrooms: 0,
    bathrooms: 4,
    areaSqft: 3000,
    mediaUrls: [
      "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
      "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
    ],
    amenities: ["WiFi", "Power Backup", "Laundry", "Parking", "CCTV", "Housekeeping", "Water Purifier", "AC", "Fridge", "TV"],
    isActive: true,
    isDeleted: false,
    postMeta: {
      pgHostel: {
        sharingTypes: [
          { type: "single", price: 12000 },
          { type: "double", price: 8000 },
          { type: "triple", price: 6000 },
        ],
        foodIncluded: true,
        foodType: "veg",
        weeklyMenu: [
          { day: "Monday", breakfast: "Poha, Tea", lunch: "Dal Rice, Roti, Sabzi", dinner: "Paneer Butter Masala, Roti, Rice" },
          { day: "Tuesday", breakfast: "Idli Sambar, Coffee", lunch: "Rajma Rice, Salad", dinner: "Chole Bhature, Rice" },
          { day: "Wednesday", breakfast: "Paratha, Curd, Tea", lunch: "Kadhi Chawal, Roti", dinner: "Mix Veg, Dal, Roti, Rice" },
          { day: "Thursday", breakfast: "Upma, Tea", lunch: "Sambar Rice, Papad", dinner: "Dal Makhani, Roti, Rice" },
          { day: "Friday", breakfast: "Bread Butter, Omelette, Tea", lunch: "Aloo Gobi, Dal, Roti", dinner: "Biryani, Raita" },
          { day: "Saturday", breakfast: "Dosa, Chutney, Coffee", lunch: "Pav Bhaji", dinner: "Palak Paneer, Roti, Rice" },
          { day: "Sunday", breakfast: "Chole Bhature, Lassi", lunch: "Special Thali", dinner: "Pasta, Garlic Bread, Soup" },
        ],
        genderPreference: "male",
        totalBeds: 40,
        availableBeds: 7,
        amenities: ["wifi", "laundry", "parking", "power_backup", "cctv", "housekeeping", "water_purifier", "ac", "fridge", "tv"],
        wifiSpeed: "100 Mbps",
        houseRules: [
          "No smoking inside premises",
          "Gate closes at 11:00 PM",
          "No loud music after 10:00 PM",
          "Guests allowed only in common area till 9 PM",
          "Monthly rent due by 5th of every month",
        ],
        nearbyColleges: ["Christ University", "Jyoti Nivas College", "St. Joseph's College"],
        nearbyOffices: ["Sony India", "Flipkart", "Swiggy HQ", "Infosys Koramangala"],
        securityDeposit: 16000,
        lockInPeriodMonths: 3,
        avgRatings: {
          food: 3.8,
          cleanliness: 4.5,
          wifi: 3.2,
          water: 4.0,
          safety: 4.6,
          landlord: 3.9,
          value_for_money: 4.1,
          location: 4.8,
        },
        reviewCount: 23,
        residentCount: 33,
        issueResponseTimeHours: 12,
      },
    },
  });
  console.log(`\n✓ Owned PG created: ${ownedPg.title} (${ownedPg._id})`);

  // ─── 2. Second PG Post (someone else's) where Hanu is a resident ────
  // We'll use Hanu as author for simplicity but the residency makes him tenant
  const anotherOwner = await User.findOne({ _id: { $ne: HANU_ID } }).lean();
  const residentPg = await PropertyPost.create({
    author: anotherOwner?._id || HANU_ID,
    authorRole: "PG_OWNER",
    postType: "PG_HOSTEL",
    status: "PUBLISHED",
    visibility: "PUBLIC",
    listingType: "PG/Hostel",
    propertyType: "PG",
    title: "Green Valley PG – HSR Layout",
    caption:
      "Spacious co-living PG in HSR Layout. Non-veg and veg food both available. " +
      "Close to Agara Lake, multiple IT parks. 24/7 security, gym access, and rooftop terrace.",
    city: "Bangalore",
    locality: "HSR Layout",
    latitude: 12.9116,
    longitude: 77.6389,
    location: { type: "Point", coordinates: [77.6389, 12.9116] },
    locationPrecision: "exact",
    price: 7000,
    priceHistory: [{ price: 7000, changedAt: new Date() }],
    bedrooms: 0,
    bathrooms: 6,
    areaSqft: 5000,
    mediaUrls: [
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
      "https://images.unsplash.com/photo-1564078516393-cf04bd966897?w=800",
    ],
    amenities: ["WiFi", "Power Backup", "Gym", "CCTV", "Housekeeping", "AC", "Fridge", "TV", "Parking"],
    isActive: true,
    isDeleted: false,
    postMeta: {
      pgHostel: {
        sharingTypes: [
          { type: "single", price: 14000 },
          { type: "double", price: 9000 },
          { type: "triple", price: 7000 },
        ],
        foodIncluded: true,
        foodType: "both",
        weeklyMenu: [
          { day: "Monday", breakfast: "Poha, Tea", lunch: "Dal Rice, Chicken Curry", dinner: "Paneer Tikka, Roti" },
          { day: "Tuesday", breakfast: "Idli, Coffee", lunch: "Rajma Rice, Fish Fry", dinner: "Egg Biryani" },
          { day: "Wednesday", breakfast: "Paratha, Curd", lunch: "Kadhi Chawal", dinner: "Butter Chicken, Naan" },
          { day: "Thursday", breakfast: "Upma, Tea", lunch: "Sambar Rice", dinner: "Dal Makhani, Roti" },
          { day: "Friday", breakfast: "Bread Omelette", lunch: "Aloo Gobi, Roti", dinner: "Chicken Biryani" },
          { day: "Saturday", breakfast: "Dosa, Chutney", lunch: "Pav Bhaji", dinner: "Palak Paneer, Roti" },
          { day: "Sunday", breakfast: "Chole Bhature", lunch: "Special Non-Veg Thali", dinner: "Pasta, Soup" },
        ],
        genderPreference: "male",
        totalBeds: 60,
        availableBeds: 12,
        amenities: ["wifi", "gym", "parking", "power_backup", "cctv", "housekeeping", "ac", "fridge", "tv"],
        wifiSpeed: "200 Mbps",
        houseRules: [
          "No smoking",
          "Gate closes at 11:30 PM",
          "No loud music after 10:30 PM",
          "Visitors allowed till 8 PM",
          "Rent due by 5th of every month",
        ],
        nearbyColleges: ["IIIT Bangalore", "NIFT Bangalore"],
        nearbyOffices: ["Wipro", "Accenture", "Google India", "Microsoft MACH"],
        securityDeposit: 18000,
        lockInPeriodMonths: 3,
        avgRatings: {
          food: 4.1,
          cleanliness: 4.3,
          wifi: 4.5,
          water: 4.2,
          safety: 4.4,
          landlord: 4.0,
          value_for_money: 3.9,
          location: 4.6,
        },
        reviewCount: 15,
        residentCount: 48,
        issueResponseTimeHours: 8,
      },
    },
  });
  console.log(`✓ Resident PG created: ${residentPg.title} (${residentPg._id})`);

  // ─── 3. PG Residency — Hanu as tenant of Green Valley PG ────────────
  const residency = await PGResidency.create({
    tenant: HANU_ID,
    pg: residentPg._id,
    roomType: "Double Sharing",
    moveInDate: new Date("2026-08-12"),
    status: "active",
    monthlyRent: 9000,
    depositAmount: 18000,
    depositPaid: true,
  });
  console.log(`✓ Residency created: ${residency._id} (status: ${residency.status})`);

  // ─── 4. PG Bills — last 3 months ────────────────────────────────────
  const bills = await PGBill.insertMany([
    {
      pg: residentPg._id,
      tenant: HANU_ID,
      month: 9,
      year: 2026,
      items: [
        { label: "Room Rent", amount: 9000 },
        { label: "Electricity", amount: 850 },
        { label: "Maintenance", amount: 500 },
      ],
      totalAmount: 10350,
      electricityUnits: 85,
      electricityPerUnit: 10,
      splitMethod: "per_meter",
      paid: true,
      paidAt: new Date("2026-09-04"),
    },
    {
      pg: residentPg._id,
      tenant: HANU_ID,
      month: 10,
      year: 2026,
      items: [
        { label: "Room Rent", amount: 9000 },
        { label: "Electricity", amount: 720 },
        { label: "Maintenance", amount: 500 },
      ],
      totalAmount: 10220,
      electricityUnits: 72,
      electricityPerUnit: 10,
      splitMethod: "per_meter",
      paid: true,
      paidAt: new Date("2026-10-03"),
    },
    {
      pg: residentPg._id,
      tenant: HANU_ID,
      month: 11,
      year: 2026,
      items: [
        { label: "Room Rent", amount: 9000 },
        { label: "Electricity", amount: 940 },
        { label: "Maintenance", amount: 500 },
        { label: "Water Charges", amount: 200 },
      ],
      totalAmount: 10640,
      electricityUnits: 94,
      electricityPerUnit: 10,
      splitMethod: "per_meter",
      paid: false,
    },
  ]);
  console.log(`✓ ${bills.length} bills created (2 paid, 1 unpaid)`);

  // ─── 5. Issue Reports — 2 open, 1 resolved ──────────────────────────
  const issues = await IssueReport.insertMany([
    {
      reporter: HANU_ID,
      pg: residentPg._id,
      category: "wifi",
      title: "WiFi disconnects frequently after midnight",
      description: "Internet drops every 15-20 mins after 12 AM. Tried restarting router multiple times. Affecting work-from-home schedule.",
      status: "acknowledged",
      priority: "high",
    },
    {
      reporter: HANU_ID,
      pg: residentPg._id,
      category: "maintenance",
      title: "Bathroom door lock broken",
      description: "The lock on 2nd floor shared bathroom is broken. Cannot lock from inside. Reported verbally 3 days ago.",
      status: "open",
      priority: "medium",
    },
    {
      reporter: HANU_ID,
      pg: residentPg._id,
      category: "water",
      title: "No hot water in morning",
      description: "Geyser in room 204 not working. No hot water available between 6-8 AM.",
      status: "resolved",
      priority: "medium",
    },
  ]);
  console.log(`✓ ${issues.length} issue reports created`);

  // ─── 6. Meal Ratings — last 5 days ──────────────────────────────────
  const today = new Date();
  const mealRatings = [];
  for (let d = 1; d <= 5; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    mealRatings.push(
      { pg: residentPg._id, rater: HANU_ID, date, mealType: "breakfast", rating: 3 + Math.floor(Math.random() * 2), comment: d === 1 ? "Idli was cold" : "" },
      { pg: residentPg._id, rater: HANU_ID, date, mealType: "lunch", rating: 3 + Math.floor(Math.random() * 3), comment: d === 2 ? "Chicken biryani was great today!" : "" },
      { pg: residentPg._id, rater: HANU_ID, date, mealType: "dinner", rating: 2 + Math.floor(Math.random() * 3), comment: d === 3 ? "Too much oil in the sabzi" : "" },
    );
  }
  const meals = await MealRating.insertMany(mealRatings);
  console.log(`✓ ${meals.length} meal ratings created (5 days × 3 meals)`);

  // ─── 7. PG Review ───────────────────────────────────────────────────
  const review = await PGReview.create({
    reviewer: HANU_ID,
    pg: residentPg._id,
    categoryRatings: {
      food: 4,
      cleanliness: 4,
      wifi: 3,
      water: 4,
      safety: 5,
      landlord: 4,
      value_for_money: 4,
      location: 5,
    },
    overallRating: 4,
    comment: "Good PG overall. Food quality is decent, location is amazing near Agara Lake. WiFi could be better. Staff is helpful and responsive to issues. Value for money is fair for HSR Layout.",
    stayDurationMonths: 3,
    verifiedResident: true,
  });
  console.log(`✓ PG Review created: ${review.overallRating}★`);

  // ─── Summary ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log("  SEED COMPLETE");
  console.log("═══════════════════════════════════════════");
  console.log(`  Owned PG (Dashboard):  ${ownedPg._id}`);
  console.log(`  Resident PG (My PG):   ${residentPg._id}`);
  console.log(`  Residency:             ${residency._id}`);
  console.log(`  Bills:                 ${bills.length}`);
  console.log(`  Issues:                ${issues.length}`);
  console.log(`  Meal Ratings:          ${meals.length}`);
  console.log(`  Review:                ${review._id}`);
  console.log("═══════════════════════════════════════════\n");

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
