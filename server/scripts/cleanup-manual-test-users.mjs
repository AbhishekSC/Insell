/**
 * Removes hand-made throwaway accounts from a database and everything
 * attached to them. Keeps the @seed.insell.local demo users and all real
 * signups.
 *
 *   node scripts/cleanup-manual-test-users.mjs           # dry run
 *   node scripts/cleanup-manual-test-users.mjs --commit  # delete
 *
 * Targets are matched by EXACT email. The script aborts if it resolves any
 * of the protected accounts below.
 */
import mongoose from "mongoose";
import "dotenv/config";

const COMMIT = process.argv.includes("--commit");

// Throwaway accounts to delete (exact email match).
const DELETE_EMAILS = [
  "neha.tester@insell.app",
  "john@gmail.com",
  "john1@gmail.com",
  "abhi@gmail.com",
  "abhi@gmail.cocm",
  "manav@gmail.com",
  "anshul@gmail.com",
  "shivam@gmail.com",
  "nikhil@gmail.com",
  "midsowus@kissypie.com",
];

// If any of these ever end up in the target set, something is wrong — stop.
const PROTECTED_EMAILS = new Set([
  "rams31824@gmail.com",
  "abhishek.s.chauhan18@gmail.com",
  "darsh@gmail.com",
  "hanu@gmail.com",
]);

await mongoose.connect(process.env.MONGO_URI);
const db = mongoose.connection.db;

const targets = await db
  .collection("users")
  .find({ email: { $in: DELETE_EMAILS } })
  .project({ fullName: 1, email: 1 })
  .toArray();

console.log(`Matched ${targets.length} / ${DELETE_EMAILS.length} target emails:`);
targets.forEach((u) => console.log("  ", u._id.toString(), "|", (u.fullName || "?").padEnd(20), "|", u.email));

if (targets.some((u) => PROTECTED_EMAILS.has(u.email))) {
  console.error("\nABORT: a protected account is in the target set.");
  await mongoose.disconnect();
  process.exit(1);
}
if (targets.length === 0) {
  console.log("\nNothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

const ids = targets.map((u) => u._id);

const posts = await db
  .collection("propertyposts")
  .find({ author: { $in: ids } })
  .project({ _id: 1, title: 1 })
  .toArray();
const postIds = posts.map((p) => p._id);
console.log(`\nPosts authored by them: ${posts.length}`);
posts.forEach((p) => console.log("  ", p._id.toString(), p.title));

const jobs = [
  ["propertyposts", { author: { $in: ids } }],
  ["offers", { $or: [{ buyer: { $in: ids } }, { seller: { $in: ids } }, { post: { $in: postIds } }] }],
  ["deals", { $or: [{ buyer: { $in: ids } }, { owner: { $in: ids } }, { post: { $in: postIds } }] }],
  ["visitrequests", { $or: [{ requester: { $in: ids } }, { owner: { $in: ids } }, { post: { $in: postIds } }] }],
  ["visitusages", { user: { $in: ids } }],
  ["propertymessages", { $or: [{ sender: { $in: ids } }, { recipient: { $in: ids } }, { post: { $in: postIds } }] }],
  ["notifications", { $or: [{ recipient: { $in: ids } }, { actor: { $in: ids } }] }],
  ["recoevents", { user: { $in: ids } }],
  ["savedsearches", { user: { $in: ids } }],
  ["pricealerts", { user: { $in: ids } }],
  ["friendrequests", { $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }],
  ["connectionrequests", { $or: [{ from: { $in: ids } }, { to: { $in: ids } }] }],
  ["reviews", { $or: [{ reviewer: { $in: ids } }, { reviewee: { $in: ids } }] }],
  ["feedreactions", { user: { $in: ids } }],
  ["comments", { author: { $in: ids } }],
  ["postreports", { $or: [{ reporter: { $in: ids } }, { post: { $in: postIds } }] }],
  ["sessions", { user: { $in: ids } }],
  ["presences", { user: { $in: ids } }],
  ["stories", { author: { $in: ids } }],
  ["highlights", { author: { $in: ids } }],
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

if (COMMIT) {
  const r = await db.collection("users").updateMany(
    {},
    { $pull: { friends: { $in: ids }, following: { $in: ids }, followers: { $in: ids }, blockedUsers: { $in: ids } } }
  );
  console.log(`  users (array cleanup): ${r.modifiedCount} modified`);
}

console.log(COMMIT ? "\nDone." : "\nNothing deleted. Re-run with --commit to apply.");
await mongoose.disconnect();
