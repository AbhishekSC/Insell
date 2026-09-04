// One-off backfill for the "Near Me" feed.
//
// 1. For posts that already have latitude/longitude but no GeoJSON `location`,
//    build the Point and mark them locationPrecision:"exact".
// 2. For posts with no coordinates, look up an approximate centroid from the
//    city name and mark them locationPrecision:"approx". Posts whose city we
//    can't resolve are left alone — they'll fall back to city-string matching
//    in the feed.
//
// Idempotent: re-running only touches posts still missing `location`.
//
//   node scripts/backfill-post-geo.mjs           (dry run — counts only)
//   node scripts/backfill-post-geo.mjs --apply   (write)
import "dotenv/config";
import mongoose from "mongoose";
import PropertyPost from "../src/models/PropertyPost.model.js";
import { centroidForCity } from "../src/utils/cityCentroids.js";

const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

const posts = await PropertyPost.find({
  isDeleted: { $ne: true },
  "location.coordinates": { $exists: false },
}).select("latitude longitude city locality").lean();

let exact = 0;
let approx = 0;
let unresolved = 0;
const bulk = [];

for (const p of posts) {
  const hasCoords = Number.isFinite(p.latitude) && Number.isFinite(p.longitude);
  if (hasCoords) {
    exact += 1;
    bulk.push({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            location: { type: "Point", coordinates: [p.longitude, p.latitude] },
            locationPrecision: "exact",
          },
        },
      },
    });
    continue;
  }
  const c = centroidForCity(p.city);
  if (c) {
    approx += 1;
    bulk.push({
      updateOne: {
        filter: { _id: p._id },
        update: {
          $set: {
            latitude: c[1],
            longitude: c[0],
            location: { type: "Point", coordinates: c },
            locationPrecision: "approx",
          },
        },
      },
    });
  } else {
    unresolved += 1;
  }
}

console.log(`Candidates: ${posts.length}`);
console.log(`  exact  (had coords):        ${exact}`);
console.log(`  approx (city centroid):     ${approx}`);
console.log(`  unresolved (kept as-is):    ${unresolved}`);

if (apply && bulk.length) {
  const res = await PropertyPost.bulkWrite(bulk, { ordered: false });
  console.log(`Applied. modified=${res.modifiedCount}`);
} else if (!apply) {
  console.log("\nDry run — pass --apply to write.");
}

await mongoose.disconnect();
