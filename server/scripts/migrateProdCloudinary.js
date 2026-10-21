import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";

import "dotenv/config";

const PROD_MONGO_URI = process.env.PROD_MONGO_URI || process.env.MONGO_URI;
const OLD_CLOUD_NAME = process.env.CLOUDINARY_OLD_CLOUD_NAME || "dbymx3fgv";
const NEW_CLOUD_NAME = process.env.CLOUDINARY_DEST_CLOUD_NAME || "glvtafat";
const NEW_API_KEY = process.env.CLOUDINARY_DEST_API_KEY;
const NEW_API_SECRET = process.env.CLOUDINARY_DEST_API_SECRET;


const BACKUP_PATH = path.resolve(process.cwd(), "scripts", "prod-migration-backup.json");
const REPORT_PATH = path.resolve(process.cwd(), "scripts", "prod-migration-report.json");

const IS_REVERT = process.argv.includes("--revert");
const IS_DRY_RUN = process.argv.includes("--dry-run");

// Configure Cloudinary destination account
cloudinary.config({
  cloud_name: NEW_CLOUD_NAME,
  api_key: NEW_API_KEY,
  api_secret: NEW_API_SECRET,
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCloudinaryUrl(url) {
  const m = url.match(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:[^\/]+:\d+\/|(?:[a-z]_[^/]+,)*[a-z]_[^/]+\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/i);
  if (m) {
    return { url, resourceType: m[1], publicId: m[2] };
  }
  const m2 = url.match(/^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/i);
  if (m2) {
    const resourceType = m2[1];
    let publicId = m2[2];
    if (resourceType !== "raw") {
      publicId = publicId.replace(/\.[a-zA-Z0-9]+$/, "");
    }
    return { url, resourceType, publicId };
  }
  return { url, resourceType: "image", publicId: null };
}

// Recursively replace occurrences of res.cloudinary.com/OLD_CLOUD_NAME with res.cloudinary.com/NEW_CLOUD_NAME
function replaceUrlInObject(obj, fromCloud, toCloud) {
  let count = 0;
  if (!obj || typeof obj !== "object") return count;

  const target = `res.cloudinary.com/${fromCloud}/`;
  const replacement = `res.cloudinary.com/${toCloud}/`;

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === "string" && obj[key].includes(target)) {
      obj[key] = obj[key].split(target).join(replacement);
      count++;
    } else if (Array.isArray(obj[key])) {
      for (let i = 0; i < obj[key].length; i++) {
        if (typeof obj[key][i] === "string" && obj[key][i].includes(target)) {
          obj[key][i] = obj[key][i].split(target).join(replacement);
          count++;
        } else if (typeof obj[key][i] === "object" && obj[key][i] !== null) {
          count += replaceUrlInObject(obj[key][i], fromCloud, toCloud);
        }
      }
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      count += replaceUrlInObject(obj[key], fromCloud, toCloud);
    }
  }
  return count;
}

async function revert() {
  console.log("=== INITIATING REVERT MODE ===");
  if (!fs.existsSync(BACKUP_PATH)) {
    throw new Error(`Backup file not found at ${BACKUP_PATH}. Cannot revert.`);
  }

  const backupData = JSON.parse(fs.readFileSync(BACKUP_PATH, "utf-8"));
  console.log(`Loaded backup with ${backupData.length} documents.`);

  await mongoose.connect(PROD_MONGO_URI);
  console.log("Connected to MongoDB for revert.");

  let restored = 0;
  for (const item of backupData) {
    const { collectionName, _id, doc } = item;
    await mongoose.connection.db.collection(collectionName).replaceOne(
      { _id: new mongoose.Types.ObjectId(_id) },
      doc
    );
    restored++;
  }

  console.log(`✅ Successfully reverted ${restored} documents back to original state.`);
  await mongoose.disconnect();
}

async function migrate() {
  console.log("=== INITIATING PROD CLOUDINARY MIGRATION ===");
  console.log(`Source Cloud: ${OLD_CLOUD_NAME}`);
  console.log(`Destination Cloud: ${NEW_CLOUD_NAME}`);
  console.log(`Dry Run: ${IS_DRY_RUN}`);

  // Test Cloudinary Ping
  console.log("\n1. Testing New Cloudinary credentials...");
  const pingRes = await cloudinary.api.ping();
  console.log("✅ Destination Cloudinary ping OK:", pingRes.status);

  // Connect to MongoDB
  console.log("\n2. Connecting to Prod MongoDB...");
  await mongoose.connect(PROD_MONGO_URI);
  console.log("✅ Connected to MongoDB:", mongoose.connection.name);

  // Scan all collections and find all docs with old Cloudinary URLs
  console.log("\n3. Scanning collections for old Cloudinary assets...");
  const collections = await mongoose.connection.db.listCollections().toArray();
  const docsToUpdate = [];
  const uniqueUrls = new Map();
  const searchRegex = new RegExp(`res\\.cloudinary\\.com/${OLD_CLOUD_NAME}/`);

  for (const col of collections) {
    const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
    for (const doc of docs) {
      const docStr = JSON.stringify(doc);
      if (searchRegex.test(docStr)) {
        docsToUpdate.push({
          collectionName: col.name,
          _id: doc._id.toString(),
          originalDoc: JSON.parse(docStr), // deep clone
        });

        // extract URLs
        const urlMatches = docStr.match(new RegExp(`https?:\\\\/\\\\/res\\.cloudinary\\.com\\\\/${OLD_CLOUD_NAME}\\\\/[^\\s",]+|https?:\\/\\/res\\.cloudinary\\.com\\/${OLD_CLOUD_NAME}\\/[^\\s",]+`, "g")) || [];
        for (let rawUrl of urlMatches) {
          const cleanUrl = rawUrl.replace(/\\\//g, "/").replace(/[\\"]/g, "");
          if (!uniqueUrls.has(cleanUrl)) {
            uniqueUrls.set(cleanUrl, parseCloudinaryUrl(cleanUrl));
          }
        }
      }
    }
  }

  console.log(`Found ${docsToUpdate.length} documents across collections containing old URLs.`);
  console.log(`Found ${uniqueUrls.size} unique Cloudinary assets to copy.`);

  // Save backup before making any changes
  if (!IS_DRY_RUN) {
    console.log(`\n4. Creating backup file at ${BACKUP_PATH}...`);
    const backupPayload = docsToUpdate.map((d) => ({
      collectionName: d.collectionName,
      _id: d._id,
      doc: d.originalDoc,
    }));
    fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupPayload, null, 2));
    console.log(`✅ Backup saved successfully with ${backupPayload.length} documents.`);
  }

  // Copy assets to new Cloudinary account
  console.log("\n5. Copying assets to destination Cloudinary account (glvtafat)...");
  const copyReport = { copied: [], skipped: [], failed: [] };

  let assetIndex = 0;
  for (const [url, parsed] of uniqueUrls.entries()) {
    assetIndex++;
    const { resourceType, publicId } = parsed;
    const progress = `[${assetIndex}/${uniqueUrls.size}]`;

    if (!publicId) {
      console.warn(`  ⚠️ ${progress} Cannot parse publicId from ${url}`);
      copyReport.failed.push({ url, error: "Cannot parse publicId" });
      continue;
    }

    try {
      // Check if already in destination
      let exists = false;
      try {
        await cloudinary.api.resource(publicId, { resource_type: resourceType });
        exists = true;
      } catch (err) {
        const code = err?.http_code ?? err?.error?.http_code;
        if (code !== 404) throw err;
      }

      if (exists) {
        console.log(`  ⏭️ ${progress} Already exists: ${resourceType}:${publicId}`);
        copyReport.skipped.push({ url, publicId, resourceType });
      } else {
        if (IS_DRY_RUN) {
          console.log(`  🔎 ${progress} Would copy: ${resourceType}:${publicId}`);
          copyReport.copied.push({ url, publicId, resourceType });
        } else {
          let uploadSuccess = false;
          let lastErr = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              const res = await cloudinary.uploader.upload(url, {
                public_id: publicId,
                resource_type: resourceType,
                overwrite: false,
                timeout: 60000,
              });
              console.log(`  ✅ ${progress} Copied: ${resourceType}:${publicId}`);
              copyReport.copied.push({ url, publicId, newUrl: res.secure_url });
              uploadSuccess = true;
              break;
            } catch (err) {
              lastErr = err;
              console.warn(`  ⚠️ ${progress} Attempt ${attempt}/3 failed for ${publicId}: ${err?.message || err}. Retrying in 2s...`);
              await sleep(2000 * attempt);
            }
          }
          if (!uploadSuccess) {
            throw lastErr;
          }
        }
      }
    } catch (err) {
      const errMsg = err?.error?.message || err?.message || String(err);
      console.error(`  ❌ ${progress} Failed: ${resourceType}:${publicId} - ${errMsg}`);
      copyReport.failed.push({ url, publicId, error: errMsg });
    }

    await sleep(200); // polite rate limit
  }

  console.log(`\nAsset copy summary: Copied ${copyReport.copied.length}, Skipped (already existed) ${copyReport.skipped.length}, Failed ${copyReport.failed.length}`);

  if (copyReport.failed.length > 0 && !IS_DRY_RUN) {
    console.error("⚠️ Some assets failed to copy. Aborting database update to prevent broken links.");
    fs.writeFileSync(REPORT_PATH, JSON.stringify({ copyReport, docsUpdated: 0 }, null, 2));
    await mongoose.disconnect();
    process.exit(1);
  }

  // Update Database documents
  console.log(`\n6. ${IS_DRY_RUN ? "Dry-running" : "Applying"} database URL rewrites in Prod MongoDB...`);
  let docsUpdated = 0;
  let fieldsReplaced = 0;

  for (const item of docsToUpdate) {
    const { collectionName, _id, originalDoc } = item;
    const modifiedDoc = JSON.parse(JSON.stringify(originalDoc));
    const count = replaceUrlInObject(modifiedDoc, OLD_CLOUD_NAME, NEW_CLOUD_NAME);

    if (count > 0) {
      fieldsReplaced += count;
      docsUpdated++;
      if (!IS_DRY_RUN) {
        delete modifiedDoc._id; // avoid immutable field error on replace
        await mongoose.connection.db.collection(collectionName).replaceOne(
          { _id: new mongoose.Types.ObjectId(_id) },
          modifiedDoc
        );
      }
    }
  }

  console.log(`✅ ${IS_DRY_RUN ? "Would update" : "Updated"} ${docsUpdated} documents (${fieldsReplaced} URL fields replaced).`);

  // Verify sample URLs on destination
  console.log("\n7. Verifying sample new URLs return HTTP 200...");
  const sampleNewUrls = Array.from(uniqueUrls.keys()).slice(0, 5).map(u => u.replace(`/${OLD_CLOUD_NAME}/`, `/${NEW_CLOUD_NAME}/`));
  let verificationsPassed = 0;
  for (const testUrl of sampleNewUrls) {
    try {
      const resp = await fetch(testUrl, { method: "HEAD" });
      if (resp.status >= 200 && resp.status < 400) {
        console.log(`  ✅ HTTP ${resp.status} OK: ${testUrl}`);
        verificationsPassed++;
      } else {
        console.warn(`  ⚠️ HTTP ${resp.status}: ${testUrl}`);
      }
    } catch (e) {
      console.error(`  ❌ Verification error for ${testUrl}:`, e.message);
    }
  }

  console.log(`\nVerifications: ${verificationsPassed}/${sampleNewUrls.length} passed.`);

  // Write final report
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ copyReport, docsUpdated, fieldsReplaced, verificationsPassed }, null, 2));
  console.log(`\nMigration completed successfully. Report saved to ${REPORT_PATH}`);

  await mongoose.disconnect();
}

const action = IS_REVERT ? revert() : migrate();
action.catch((err) => {
  console.error("\nFATAL ERROR during operation:", err);
  process.exit(1);
});
