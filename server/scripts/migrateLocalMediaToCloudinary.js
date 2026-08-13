import "dotenv/config";
import path from "path";
import fs from "fs";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { connectToMongoDB } from "../src/config/db.config.js";
import PropertyPost from "../src/models/PropertyPost.model.js";

const LOCALHOST_PREFIX_RE = /^http:\/\/localhost:\d+\/uploads\/property-media\//;
const LOCAL_UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "property-media");

function configureCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary configuration is incomplete. Please check your environment variables.");
  }
  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
}

async function migrateLocalMediaToCloudinary() {
  await connectToMongoDB();
  configureCloudinary();

  const posts = await PropertyPost.find({ mediaUrls: { $regex: LOCALHOST_PREFIX_RE } });
  console.log(`Found ${posts.length} posts with local media URLs.`);

  let fixedFiles = 0;
  let skippedMissing = 0;

  for (const post of posts) {
    let changed = false;

    for (let i = 0; i < post.mediaUrls.length; i++) {
      const url = post.mediaUrls[i];
      if (!LOCALHOST_PREFIX_RE.test(url)) continue;

      const filename = decodeURIComponent(url.split("/uploads/property-media/")[1] || "");
      const localPath = path.join(LOCAL_UPLOADS_DIR, filename);

      if (!filename || !fs.existsSync(localPath)) {
        console.warn(`  ⚠️  Missing local file for post ${post._id}: ${filename || url}`);
        skippedMissing++;
        continue;
      }

      const isVideo = /\.(mp4|webm|mov)$/i.test(filename);
      const uploadResult = await cloudinary.uploader.upload(localPath, {
        folder: "property-media",
        resource_type: isVideo ? "video" : "image",
      });

      console.log(`  ✅ ${post._id}: ${filename} -> ${uploadResult.secure_url}`);
      post.mediaUrls[i] = uploadResult.secure_url;
      changed = true;
      fixedFiles++;
    }

    if (changed) {
      post.markModified("mediaUrls");
      await post.save();
    }
  }

  console.log(`\nDone. Fixed ${fixedFiles} file(s) across ${posts.length} post(s). Skipped ${skippedMissing} missing file(s).`);
  await mongoose.disconnect();
}

migrateLocalMediaToCloudinary().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
