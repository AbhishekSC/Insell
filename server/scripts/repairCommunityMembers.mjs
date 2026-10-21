/**
 * Repair script: fixes communities where members/creator/pendingInvites/
 * pendingJoinRequests were saved as plain strings instead of ObjectIds
 * (caused by the old read-modify-write pattern that spread arrays into
 * new string arrays, then called .save()).
 *
 * Usage:
 *   MONGO_URI="mongodb+srv://..." node scripts/repairCommunityMembers.mjs
 *   MONGO_URI="mongodb+srv://..." node scripts/repairCommunityMembers.mjs --apply
 */

import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("Set MONGO_URI env var");
  process.exit(1);
}

const dryRun = !process.argv.includes("--apply");
if (dryRun) console.log("=== DRY RUN (pass --apply to write) ===\n");

await mongoose.connect(uri);
const db = mongoose.connection.db;
const collection = db.collection("studycircles");

const circles = await collection.find({}).toArray();
let fixCount = 0;

for (const circle of circles) {
  const updates = {};
  let needsFix = false;

  // Fix creator if stored as string
  if (typeof circle.creator === "string") {
    updates.creator = new mongoose.Types.ObjectId(circle.creator);
    needsFix = true;
  }

  // Fix members array — convert strings to ObjectIds
  const fields = ["members", "moderators", "pendingInvites", "pendingJoinRequests"];
  for (const field of fields) {
    const arr = circle[field];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const hasStrings = arr.some((v) => typeof v === "string");
    if (hasStrings) {
      updates[field] = arr.map((v) =>
        typeof v === "string" ? new mongoose.Types.ObjectId(v) : v
      );
      needsFix = true;
    }
  }

  if (needsFix) {
    fixCount++;
    const fixedFields = Object.keys(updates).join(", ");
    console.log(`FIXING: "${circle.name}" (${circle._id}) — string IDs in: ${fixedFields}`);

    if (!dryRun) {
      await collection.updateOne({ _id: circle._id }, { $set: updates });
      console.log("  -> Fixed");
    }
  }
}

if (fixCount === 0) {
  console.log("All communities have correct ObjectId types — nothing to fix.");
} else {
  console.log(`\n${fixCount} communities ${dryRun ? "would be" : "were"} repaired.`);
}

await mongoose.disconnect();
