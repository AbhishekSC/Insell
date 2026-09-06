/**
 * Removes the throwaway accounts the automated end-to-end test left behind
 * on 2026-09-05 ("E2E Buyer" / "E2E Owner") and everything attached to them.
 *
 *   node scripts/cleanup-e2e-users.mjs           # dry run - prints what WOULD go
 *   node scripts/cleanup-e2e-users.mjs --commit  # actually delete
 *
 * Scoped strictly to the two user _ids below. Nothing else is touched.
 */
import mongoose from "mongoose";
import "dotenv/config";

const COMMIT = process.argv.includes("--commit");

// The two E2E accounts. Verified emails match e2e-b-*@t.test / e2e-o-*@t.test.
const USER_IDS = [
  "6a9c2f0e7a57365f14b633c8", // E2E Buyer
  "6a9c2f0d7a57365f14b633bc", // E2E Owner
];

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;
const ids = USER_IDS.map((s) => new mongoose.Types.ObjectId(s));

// Safety check: confirm these really are the E2E accounts before doing anything.
const users = await db.collection("users").find({ _id: { $in: ids } }).project({ fullName: 1, email: 1 }).toArray();
console.log("Target accounts:");
users.forEach((u) => console.log("  ", u._id.toString(), u.fullName, u.email));
const allE2E = users.length === 2 && users.every((u) => /@t\.test$/.test(u.email || ""));
if (!allE2E) {
  console.error("\nABORT: one or more targets is not an @t.test account. Refusing to run.");
  await mongoose.disconnect();
  process.exit(1);
}

// posts authored by them (needed to also clear post-scoped children)
const posts = await db.collection("propertyposts").find({ author: { $in: ids } }).project({ _id: 1, title: 1 }).toArray();
const postIds = posts.map((p) => p._id);
console.log(`\nPosts authored by them: ${posts.length}`);
posts.forEach((p) => console.log("  ", p._id.toString(), p.title));

// collection -> filter
const jobs = [
  ["propertyposts", { author: { $in: ids } }],
  ["offers", { $or: [{ buyer: { $in: ids } }, { seller: { $in: ids } }, { post: { $in: postIds } }] }],
  ["deals", { $or: [{ buyer: { $in: ids } }, { owner: { $in: ids } }, { post: { $in: postIds } }] }],
  ["visitrequests", { $or: [{ requester: { $in: ids } }, { owner: { $in: ids } }, { post: { $in: postIds } }] }],
  ["visitusages", { user: { $in: ids } }],
  ["propertymessages", { $or: [{ sender: { $in: ids } }, { recipient: { $in: ids } }, { post: { $in: postIds } }] }],
  ["notifications", { $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }] }],
  ["recoevents", { user: { $in: ids } }],
  ["friendrequests", { $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }],
  ["connectionrequests", { $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }],
  ["reviews", { $or: [{ reviewer: { $in: ids } }, { reviewee: { $in: ids } }] }],
  ["feedreactions", { user: { $in: ids } }],
  ["comments", { author: { $in: ids } }],
  ["postreports", { $or: [{ reporter: { $in: ids } }, { post: { $in: postIds } }] }],
  ["sessions", { user: { $in: ids } }],
  ["presences", { user: { $in: ids } }],
  ["stories", { author: { $in: ids } }],
  ["users", { _id: { $in: ids } }],
];

console.log(`\n${COMMIT ? "DELETING" : "DRY RUN - would delete"}:`);
for (const [coll, filter] of jobs) {
  const c = db.collection(coll);
  const n = await c.countDocuments(filter);
  if (n === 0) continue;
  if (COMMIT) {
    const r = await c.deleteMany(filter);
    console.log(`  ${coll}: ${r.deletedCount}`);
  } else {
    console.log(`  ${coll}: ${n}`);
  }
}

// pull them out of other users' friends/following arrays
if (COMMIT) {
  const r = await db.collection("users").updateMany(
    {},
    { $pull: { friends: { $in: ids }, following: { $in: ids }, followers: { $in: ids }, blockedUsers: { $in: ids } } }
  );
  console.log(`  users (array cleanup): ${r.modifiedCount} modified`);
}

console.log(COMMIT ? "\nDone." : "\nNothing deleted. Re-run with --commit to apply.");
await mongoose.disconnect();
