import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { connectToMongoDB } from "../src/config/db.config.js";
import User from "../src/models/User.model.js";

function parseArgs(argv) {
  const config = {
    count: 60,
    password: "Password@123",
    prefix: "autouser",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--count") {
      config.count = Number(argv[index + 1] || config.count);
      index += 1;
      continue;
    }
    if (token === "--password") {
      config.password = String(argv[index + 1] || config.password);
      index += 1;
      continue;
    }
    if (token === "--prefix") {
      config.prefix = String(argv[index + 1] || config.prefix);
      index += 1;
    }
  }

  config.count = Number.isFinite(config.count) ? Math.max(1, Math.min(200, Math.round(config.count))) : 60;
  return config;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function sampleMany(list, count) {
  const copy = [...list];
  const picked = [];
  while (copy.length > 0 && picked.length < count) {
    const index = Math.floor(Math.random() * copy.length);
    picked.push(copy[index]);
    copy.splice(index, 1);
  }
  return picked;
}

async function seedUsers() {
  const options = parseArgs(process.argv.slice(2));
  mongoose.set("debug", false);

  const firstNames = [
    "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Kabir", "Ishaan", "Reyansh", "Ayaan", "Krish",
    "Anaya", "Diya", "Myra", "Aadhya", "Sara", "Riya", "Meera", "Kiara", "Anika", "Ira",
  ];
  const lastNames = [
    "Sharma", "Verma", "Singh", "Gupta", "Mishra", "Yadav", "Khan", "Patel", "Reddy", "Joshi",
  ];
  const cities = [
    "Kanpur", "Lucknow", "Delhi", "Mumbai", "Bengaluru", "Pune", "Jaipur", "Indore", "Kolkata", "Chandigarh",
  ];
  const languages = ["Hindi", "English", "Spanish", "French", "German", "Japanese", "Korean", "Italian", "Portuguese", "Arabic"];
  const styles = ["Backpacker", "Road trips", "Weekend explorer", "Slow travel", "Food trails", "Nature lover", "Digital nomad"];
  const interests = ["Food", "Culture", "Hiking", "Photography", "History", "Beaches", "Mountains", "Nightlife", "Museums", "Shopping"];
  const destinations = ["Goa", "Manali", "Leh", "Jaipur", "Varanasi", "Kerala", "Rishikesh", "Udaipur", "Pondicherry", "Sikkim"];

  await connectToMongoDB();

  const hashedPassword = await bcrypt.hash(options.password, 10);
  const timestamp = Date.now();
  const userDocs = [];

  for (let i = 0; i < options.count; i += 1) {
    const fullName = `${pickRandom(firstNames)} ${pickRandom(lastNames)}`;
    const nativeLanguage = pickRandom(languages);
    const learningCandidates = languages.filter((item) => item !== nativeLanguage);
    const learningLanguage = pickRandom(learningCandidates);
    const city = pickRandom(cities);

    userDocs.push({
      fullName,
      email: `${options.prefix}${timestamp}${String(i + 1).padStart(3, "0")}@seed.syncspace.local`,
      password: hashedPassword,
      bio: `Hey there, I want to learn ${learningLanguage} and explore new trips.`,
      profilePic: "",
      nativeLanguage,
      learningLanguage,
      homeBase: city,
      travelStyle: pickRandom(styles),
      travelInterests: sampleMany(interests, 3),
      favoriteDestinations: sampleMany(destinations, 3),
      location: city,
      isOnboarded: true,
      friends: [],
    });
  }

  const insertedUsers = await User.insertMany(userDocs, { ordered: false });
  const userIds = insertedUsers.map((user) => String(user._id));
  const friendGraph = new Map(userIds.map((id) => [id, new Set()]));

  for (const userId of userIds) {
    const available = userIds.filter((id) => id !== userId);
    const desired = 2 + Math.floor(Math.random() * 5);
    const selected = sampleMany(available, desired);
    for (const targetId of selected) {
      friendGraph.get(userId).add(targetId);
      friendGraph.get(targetId).add(userId);
    }
  }

  const bulkOps = [];
  for (const [userId, friendIds] of friendGraph.entries()) {
    bulkOps.push({
      updateOne: {
        filter: { _id: new mongoose.Types.ObjectId(userId) },
        update: { $addToSet: { friends: { $each: [...friendIds].map((id) => new mongoose.Types.ObjectId(id)) } } },
      },
    });
  }

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
  }

  console.log("Seed completed successfully");
  console.log(`Created users: ${insertedUsers.length}`);
  console.log(`Login password for all seeded users: ${options.password}`);
  console.log(`Email pattern example: ${insertedUsers[0]?.email || "n/a"}`);

  await mongoose.connection.close();
}

seedUsers().catch(async (error) => {
  console.error("Failed to seed users:", error?.message || error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors in failure path.
  }
  process.exit(1);
});