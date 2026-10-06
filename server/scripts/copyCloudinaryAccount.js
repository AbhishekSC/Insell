import "dotenv/config";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

// Copies every asset from the SOURCE Cloudinary account (CLOUDINARY_* env vars,
// currently the account nearing its credit limit) to a DESTINATION account
// (CLOUDINARY_DEST_* env vars), preserving folder + public_id + resource_type
// so every stored URL in MongoDB only needs its cloud-name segment rewritten
// afterward (see rewriteCloudinaryUrls.js) — nothing else about the path changes.
//
// Usage:
//   node scripts/copyCloudinaryAccount.js            # copy everything, skip already-copied
//   node scripts/copyCloudinaryAccount.js --dry-run   # list what would be copied, copy nothing
//
// Required env vars (in server/.env):
//   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET   (source)
//   CLOUDINARY_DEST_CLOUD_NAME / CLOUDINARY_DEST_API_KEY / CLOUDINARY_DEST_API_SECRET  (destination)

const DRY_RUN = process.argv.includes("--dry-run");
const REPORT_PATH = path.resolve(process.cwd(), "scripts", "cloudinary-copy-report.json");
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 250; // stay well under Cloudinary's rate limits

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sourceClient() {
  const client = cloudinary; // default singleton config = source account
  client.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  });
  return client;
}

// A second, independently-configured Cloudinary instance for the destination
// account (the SDK's config is global, so we swap config between calls).
function destConfig() {
  return {
    cloud_name: requireEnv("CLOUDINARY_DEST_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_DEST_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_DEST_API_SECRET"),
  };
}

async function listAllResources(client, resourceType) {
  const resources = [];
  let nextCursor;
  do {
    const response = await client.api.resources({
      resource_type: resourceType,
      type: "upload",
      max_results: PAGE_SIZE,
      next_cursor: nextCursor,
    });
    resources.push(...response.resources);
    nextCursor = response.next_cursor;
    await sleep(REQUEST_DELAY_MS);
  } while (nextCursor);
  return resources;
}

async function destAssetExists(client, publicId, resourceType) {
  try {
    cloudinary.config(destConfig());
    await client.api.resource(publicId, { resource_type: resourceType });
    return true;
  } catch (error) {
    if (error?.http_code === 404) return false;
    throw error;
  }
}

async function copyOne(client, asset, resourceType) {
  cloudinary.config(destConfig());
  await client.uploader.upload(asset.secure_url, {
    public_id: asset.public_id,
    resource_type: resourceType,
    overwrite: false,
  });
}

async function migrate() {
  const client = sourceClient();

  const report = { copied: [], skippedExisting: [], failed: [], dryRun: DRY_RUN };

  for (const resourceType of ["image", "video", "raw"]) {
    cloudinary.config({
      cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
      api_key: requireEnv("CLOUDINARY_API_KEY"),
      api_secret: requireEnv("CLOUDINARY_API_SECRET"),
    });

    console.log(`\nListing ${resourceType} assets on source account...`);
    const assets = await listAllResources(client, resourceType);
    console.log(`Found ${assets.length} ${resourceType} asset(s).`);

    for (const asset of assets) {
      const label = `${resourceType}:${asset.public_id}`;
      try {
        const alreadyThere = await destAssetExists(client, asset.public_id, resourceType);
        if (alreadyThere) {
          console.log(`  ⏭️  already on destination: ${label}`);
          report.skippedExisting.push(label);
          continue;
        }

        if (DRY_RUN) {
          console.log(`  🔎 would copy: ${label}`);
          report.copied.push(label);
          continue;
        }

        await copyOne(client, asset, resourceType);
        console.log(`  ✅ copied: ${label}`);
        report.copied.push(label);
      } catch (error) {
        console.error(`  ❌ failed: ${label} — ${error.message}`);
        report.failed.push({ label, error: error.message });
      }
      await sleep(REQUEST_DELAY_MS);
    }
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(
    `\nDone${DRY_RUN ? " (dry run)" : ""}. Copied ${report.copied.length}, skipped ${report.skippedExisting.length}, failed ${report.failed.length}.`
  );
  console.log(`Report written to ${REPORT_PATH}`);

  if (report.failed.length > 0) {
    process.exitCode = 1;
  }
}

migrate().catch((error) => {
  console.error("Cloudinary account copy failed:", error);
  process.exit(1);
});
