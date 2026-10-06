import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongoDB } from "../src/config/db.config.js";
import PropertyPost from "../src/models/PropertyPost.model.js";
import User from "../src/models/User.model.js";
import Story from "../src/models/Story.model.js";
import Feedback from "../src/models/Feedback.model.js";
import OwnerVerificationRequest from "../src/models/OwnerVerificationRequest.model.js";
import SharedExpense from "../src/models/SharedExpense.model.js";
import Deal from "../src/models/Deal.model.js";
import Announcement from "../src/models/Announcement.model.js";
import Highlight from "../src/models/Highlight.model.js";
import CommunityResource from "../src/models/CommunityResource.model.js";

// Rewrites the Cloudinary cloud-name segment of every stored media/document
// URL after assets have been copied to a new Cloudinary account with
// copyCloudinaryAccount.js (which preserves public_id/folder, so only the
// cloud name in the URL actually changes — everything after it stays identical).
//
// Usage:
//   node scripts/rewriteCloudinaryUrls.js              # dry run: report matches only
//   node scripts/rewriteCloudinaryUrls.js --apply       # actually update documents
//
// Required env vars:
//   CLOUDINARY_OLD_CLOUD_NAME   e.g. dbymx3fgv (the account being migrated away from)
//   CLOUDINARY_DEST_CLOUD_NAME  the new account's cloud name

const APPLY = process.argv.includes("--apply");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function buildTargets(oldCloud) {
  const urlHost = `res.cloudinary.com/${oldCloud}/`;
  const regex = new RegExp(urlHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return [
    { model: PropertyPost, label: "PropertyPost.mediaUrls", path: "mediaUrls", isArray: true },
    { model: User, label: "User.profilePic", path: "profilePic", isArray: false },
    { model: Story, label: "Story.mediaUrl", path: "mediaUrl", isArray: false },
    { model: Feedback, label: "Feedback.screenshotUrl", path: "screenshotUrl", isArray: false },
    {
      model: OwnerVerificationRequest,
      label: "OwnerVerificationRequest.docUrl",
      path: "docUrl",
      isArray: false,
    },
    { model: SharedExpense, label: "SharedExpense.receiptUrl", path: "receiptUrl", isArray: false },
    { model: Deal, label: "Deal.attachments[].url", path: "attachments", isArray: "subdoc", subPath: "url" },
    { model: Announcement, label: "Announcement.image", path: "image", isArray: false },
    { model: Highlight, label: "Highlight.coverImage", path: "coverImage", isArray: false },
    { model: CommunityResource, label: "CommunityResource.url", path: "url", isArray: false },
  ].map((target) => ({ ...target, regex, urlHost }));
}

function replaceHost(url, urlHost, newCloud) {
  return url.replace(`res.cloudinary.com/${urlHost.split("/")[1]}/`, `res.cloudinary.com/${newCloud}/`);
}

async function processTarget(target, newCloud, summary) {
  const { model, label, path, isArray, subPath, regex, urlHost } = target;
  const filter = isArray === "subdoc" ? { [`${path}.${subPath}`]: regex } : { [path]: regex };

  const docs = await model.find(filter);
  let fieldsChanged = 0;

  for (const doc of docs) {
    let changed = false;

    if (isArray === true) {
      const arr = doc[path] || [];
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "string" && regex.test(arr[i])) {
          const rewritten = replaceHost(arr[i], urlHost, newCloud);
          if (APPLY) arr[i] = rewritten;
          changed = true;
          fieldsChanged++;
        }
      }
      if (APPLY && changed) doc.markModified(path);
    } else if (isArray === "subdoc") {
      for (const sub of doc[path] || []) {
        if (typeof sub[subPath] === "string" && regex.test(sub[subPath])) {
          const rewritten = replaceHost(sub[subPath], urlHost, newCloud);
          if (APPLY) sub[subPath] = rewritten;
          changed = true;
          fieldsChanged++;
        }
      }
      if (APPLY && changed) doc.markModified(path);
    } else if (typeof doc[path] === "string" && regex.test(doc[path])) {
      const rewritten = replaceHost(doc[path], urlHost, newCloud);
      if (APPLY) doc[path] = rewritten;
      changed = true;
      fieldsChanged++;
    }

    if (APPLY && changed) await doc.save();
  }

  summary.push({ label, documentsMatched: docs.length, fieldsChanged });
  console.log(
    `${APPLY ? "✅ Updated" : "🔎 Would update"} ${label}: ${docs.length} document(s), ${fieldsChanged} field value(s).`
  );
}

async function run() {
  await connectToMongoDB();

  const oldCloud = requireEnv("CLOUDINARY_OLD_CLOUD_NAME");
  const newCloud = requireEnv("CLOUDINARY_DEST_CLOUD_NAME");

  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no writes)"}`);
  console.log(`Rewriting res.cloudinary.com/${oldCloud}/... -> res.cloudinary.com/${newCloud}/...\n`);

  const targets = buildTargets(oldCloud);
  const summary = [];

  for (const target of targets) {
    await processTarget(target, newCloud, summary);
  }

  const totalDocs = summary.reduce((sum, s) => sum + s.documentsMatched, 0);
  const totalFields = summary.reduce((sum, s) => sum + s.fieldsChanged, 0);
  console.log(`\nDone. ${totalDocs} document(s) matched, ${totalFields} field value(s) ${APPLY ? "updated" : "would be updated"}.`);
  if (!APPLY) {
    console.log("This was a dry run — re-run with --apply to write changes.");
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Cloudinary URL rewrite failed:", error);
  process.exit(1);
});
