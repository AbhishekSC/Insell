import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongoDB } from "../src/config/db.config.js";
import User from "../src/models/User.model.js";

async function verifyExistingUsers() {
  await connectToMongoDB();

  const result = await User.updateMany(
    { isVerified: { $ne: true } },
    { $set: { isVerified: true }, $unset: { verificationCode: "", verificationCodeExpires: "" } }
  );

  console.log(`Marked ${result.modifiedCount} existing user(s) as verified.`);

  await mongoose.connection.close();
}

verifyExistingUsers().catch((error) => {
  console.error("Failed to grandfather-verify existing users:", error);
  process.exit(1);
});
