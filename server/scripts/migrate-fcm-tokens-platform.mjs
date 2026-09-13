// One-off migration for platform-tagged FCM tokens.
//
// `User.fcmTokens` used to be a plain string array (every token implicitly
// a web browser). It's now an array of { token, platform, updatedAt } so
// NotificationService can send web clients a clickable `url` and mobile
// clients a platform-neutral payload instead. This rewrites any existing
// plain-string entries into that shape (platform: "web", since every token
// registered before this migration came from the web app) — no tokens are
// dropped, only reshaped.
//
// Idempotent: re-running only touches users who still have a raw string
// left in fcmTokens (already-migrated users are skipped).
//
//   node scripts/migrate-fcm-tokens-platform.mjs           (dry run — counts only)
//   node scripts/migrate-fcm-tokens-platform.mjs --apply   (write)
import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");

await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);

// Raw collection access, bypassing the (already-updated) Mongoose model —
// its schema now expects subdocuments, so reading through it would coerce
// or reject the very legacy strings this script needs to see.
const users = await mongoose.connection
  .collection("users")
  .find({ fcmTokens: { $elemMatch: { $type: "string" } } })
  .project({ fcmTokens: 1 })
  .toArray();

let usersTouched = 0;
let tokensConverted = 0;
const bulk = [];

for (const user of users) {
  const now = new Date();
  const converted = (user.fcmTokens || []).map((entry) =>
    typeof entry === "string" ? { token: entry, platform: "web", updatedAt: now } : entry
  );
  const changedCount = (user.fcmTokens || []).filter((e) => typeof e === "string").length;
  if (changedCount === 0) continue;

  usersTouched += 1;
  tokensConverted += changedCount;
  bulk.push({
    updateOne: {
      filter: { _id: user._id },
      update: { $set: { fcmTokens: converted } },
    },
  });
}

console.log(`[fcm-token migration] users needing conversion: ${usersTouched}, tokens to convert: ${tokensConverted}`);

if (!apply) {
  console.log("Dry run only — pass --apply to write these changes.");
} else if (bulk.length > 0) {
  const result = await mongoose.connection.collection("users").bulkWrite(bulk, { ordered: false });
  console.log(`Applied. Matched: ${result.matchedCount}, modified: ${result.modifiedCount}`);
} else {
  console.log("Nothing to apply.");
}

await mongoose.disconnect();
