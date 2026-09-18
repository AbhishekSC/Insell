// Side-by-side document counts for every collection in SRC vs DST, so you
// can confirm a migration copied everything.
//
//   export SRC='mongodb+srv://.../insell_db?...'
//   export DST='mongodb+srv://.../insell_db?...'
//   node server/scripts/verify-migration.mjs
//
// If DST has no db name in the URI, insell_db is assumed.
import { MongoClient } from "mongodb";

const { SRC, DST } = process.env;
if (!SRC || !DST) {
  console.error("Set SRC and DST env vars first.");
  process.exit(1);
}

async function counts(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  const dbName = new URL(uri.replace("mongodb+srv://", "https://")).pathname.replace(/^\//, "") || "insell_db";
  const db = client.db(dbName);
  const cols = await db.listCollections().toArray();
  const out = {};
  for (const c of cols) {
    out[c.name] = await db.collection(c.name).countDocuments();
  }
  await client.close();
  return out;
}

const [src, dst] = await Promise.all([counts(SRC), counts(DST)]);
const names = [...new Set([...Object.keys(src), ...Object.keys(dst)])].sort();

let mismatch = 0;
console.log("collection".padEnd(28), "SRC".padStart(10), "DST".padStart(10), "  ");
console.log("-".repeat(54));
for (const n of names) {
  const s = src[n] ?? 0;
  const d = dst[n] ?? 0;
  const ok = s === d;
  if (!ok) mismatch++;
  console.log(n.padEnd(28), String(s).padStart(10), String(d).padStart(10), ok ? " ok" : " ✗ MISMATCH");
}
console.log("-".repeat(54));
console.log(mismatch === 0 ? "✓ all collections match" : `✗ ${mismatch} collection(s) differ`);
process.exit(mismatch === 0 ? 0 : 1);
