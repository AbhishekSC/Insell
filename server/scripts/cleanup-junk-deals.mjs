/**
 * Removes the junk Deal rows that were lazy-created from old accepted offers
 * (mostly orphaned - buyer/owner/post deleted, stuck at "documents", ~Rs 90,000).
 *
 *   node scripts/cleanup-junk-deals.mjs           # dry run
 *   node scripts/cleanup-junk-deals.mjs --commit  # delete
 *
 * Only touches ACTIVE deals that never progressed past "agreed", have no
 * attachments, no reports, and <=1 history entry. Real completed/cancelled
 * deals and any deal with real activity are left alone.
 */
import mongoose from "mongoose";
import "dotenv/config";

const COMMIT = process.argv.includes("--commit");

await mongoose.connect(process.env.MONGO_URI);
const deals = mongoose.connection.db.collection("deals");

const filter = {
  status: "ACTIVE",
  completedStages: ["agreed"],
  $or: [{ attachments: { $exists: false } }, { attachments: { $size: 0 } }],
  $and: [
    { $or: [{ reports: { $exists: false } }, { reports: { $size: 0 } }] },
    { $expr: { $lte: [{ $size: { $ifNull: ["$history", []] } }, 1] } },
  ],
};

const n = await deals.countDocuments(filter);
const total = await deals.countDocuments({});
const sample = await deals.find(filter).limit(5).project({ agreedPrice: 1, currentStage: 1, createdAt: 1 }).toArray();

console.log(`Total deals: ${total}`);
console.log(`Match junk filter: ${n}`);
console.log("Sample:", sample.map((d) => `${d.currentStage} Rs${d.agreedPrice} ${d.createdAt?.toISOString().slice(0, 10)}`));

if (COMMIT) {
  const r = await deals.deleteMany(filter);
  console.log(`\nDeleted ${r.deletedCount}. Remaining: ${await deals.countDocuments({})}`);
} else {
  console.log("\nDry run - re-run with --commit to delete.");
}

await mongoose.disconnect();
