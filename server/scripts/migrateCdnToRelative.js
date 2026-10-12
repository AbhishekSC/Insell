import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongoDB } from "../src/config/db.config.js";
import { stripCdnBase } from "../src/utils/cdnUrl.js";
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

// Migrates absolute Cloudinary URLs in MongoDB into clean relative paths (e.g. image/upload/...)
// so that the database is completely decoupled from any specific CDN host or Cloudinary account name.
//
// Usage:
//   node scripts/migrateCdnToRelative.js           # dry run: inspect what would be converted
//   node scripts/migrateCdnToRelative.js --apply   # write changes to MongoDB

const APPLY = process.argv.includes("--apply");

const TARGETS = [
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
];

const CLOUDINARY_REGEX = /https?:\/\/res\.cloudinary\.com\/[^\/]+\//i;

async function processTarget(target, summary) {
  const { model, label, path, isArray, subPath } = target;
  const filter = isArray === "subdoc" ? { [`${path}.${subPath}`]: CLOUDINARY_REGEX } : { [path]: CLOUDINARY_REGEX };

  const docs = await model.find(filter);
  let fieldsChanged = 0;

  for (const doc of docs) {
    let changed = false;

    if (isArray === true) {
      const arr = doc[path] || [];
      for (let i = 0; i < arr.length; i++) {
        if (typeof arr[i] === "string" && CLOUDINARY_REGEX.test(arr[i])) {
          const stripped = stripCdnBase(arr[i]);
          if (stripped !== arr[i]) {
            if (APPLY) arr[i] = stripped;
            changed = true;
            fieldsChanged++;
          }
        }
      }
      if (APPLY && changed) doc.markModified(path);
    } else if (isArray === "subdoc") {
      for (const sub of doc[path] || []) {
        if (typeof sub[subPath] === "string" && CLOUDINARY_REGEX.test(sub[subPath])) {
          const stripped = stripCdnBase(sub[subPath]);
          if (stripped !== sub[subPath]) {
            if (APPLY) sub[subPath] = stripped;
            changed = true;
            fieldsChanged++;
          }
        }
      }
      if (APPLY && changed) doc.markModified(path);
    } else if (typeof doc[path] === "string" && CLOUDINARY_REGEX.test(doc[path])) {
      const stripped = stripCdnBase(doc[path]);
      if (stripped !== doc[path]) {
        if (APPLY) doc[path] = stripped;
        changed = true;
        fieldsChanged++;
      }
    }

    if (APPLY && changed) await doc.save();
  }

  summary.push({ label, documentsMatched: docs.length, fieldsChanged });
  console.log(
    `${APPLY ? "✅ Converted" : "🔎 Would convert"} ${label}: ${docs.length} document(s), ${fieldsChanged} field value(s).`
  );
}

async function run() {
  await connectToMongoDB();

  console.log(`Mode: ${APPLY ? "APPLY (writing changes)" : "DRY RUN (no writes)"}`);
  console.log("Converting https://res.cloudinary.com/<cloud>/... -> relative paths in MongoDB...\n");

  const summary = [];
  for (const target of TARGETS) {
    await processTarget(target, summary);
  }

  const totalDocs = summary.reduce((sum, s) => sum + s.documentsMatched, 0);
  const totalFields = summary.reduce((sum, s) => sum + s.fieldsChanged, 0);
  console.log(
    `\nDone. ${totalDocs} document(s) matched, ${totalFields} field value(s) ${APPLY ? "converted" : "would be converted"}.`
  );
  if (!APPLY) {
    console.log("This was a dry run — re-run with --apply to write changes.");
  }

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
