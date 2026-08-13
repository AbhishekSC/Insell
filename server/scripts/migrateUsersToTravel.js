import "dotenv/config";
import mongoose from "mongoose";
import { connectToMongoDB } from "../src/config/db.config.js";
import User from "../src/models/User.model.js";

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

function buildRealEstateBio(fullName, city, role, propertyTypes) {
  const firstName = String(fullName || "User").split(" ")[0] || "User";
  const leadType = propertyTypes[0] || "residential homes";
  return `${firstName} in ${city} is active as a ${role.toLowerCase()} and currently focused on ${leadType.toLowerCase()}.`;
}

async function migrateUsersToMarketplace() {
  mongoose.set("debug", false);

  const rolePool = [
    "Buyer",
    "Seller",
    "Tenant",
    "Landlord",
    "Broker",
  ];
  const propertyTypePool = [
    "Apartment",
    "Independent House",
    "Villa",
    "Plot",
    "Commercial",
    "Agricultural Land",
    "Rental",
  ];
  const localitiesPool = [
    "City Center",
    "West End",
    "Airport Road",
    "Vijay Nagar",
    "New Town",
    "Sector 62",
    "Whitefield",
    "Baner",
    "Hinjewadi",
    "Gachibowli",
  ];
  const fallbackCities = [
    "Kanpur",
    "Lucknow",
    "Delhi",
    "Mumbai",
    "Bengaluru",
    "Pune",
    "Jaipur",
    "Indore",
    "Kolkata",
    "Chandigarh",
  ];

  await connectToMongoDB();

  const users = await User.find({}).select(
    "fullName bio city primaryRole userRoles preferredLocalities propertyTypePreferences budgetMin budgetMax listingIntent homeBase location travelStyle travelInterests favoriteDestinations nativeLanguage learningLanguage isOnboarded"
  );

  if (users.length === 0) {
    console.log("No users found for real estate migration.");
    await mongoose.connection.close();
    return;
  }

  const updates = [];
  let changedCount = 0;

  for (const user of users) {
    const resolvedCity = String(user.city || user.homeBase || user.location || "").trim() || pickRandom(fallbackCities);
    const resolvedPrimaryRole = String(user.primaryRole || user.travelStyle || user.learningLanguage || "").trim() || pickRandom(rolePool);

    const existingRoles = Array.isArray(user.userRoles)
      ? user.userRoles.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const resolvedRoles = existingRoles.length > 0
      ? existingRoles
      : [resolvedPrimaryRole];

    const existingPropertyTypes = Array.isArray(user.propertyTypePreferences)
      ? user.propertyTypePreferences.map((item) => String(item || "").trim()).filter(Boolean)
      : Array.isArray(user.travelInterests)
        ? user.travelInterests.map((item) => String(item || "").trim()).filter(Boolean)
        : [];
    const fallbackPropertyType = String(user.nativeLanguage || "").trim();
    const resolvedPropertyTypes =
      existingPropertyTypes.length > 0
        ? existingPropertyTypes
        : fallbackPropertyType
          ? [fallbackPropertyType, ...sampleMany(propertyTypePool.filter((item) => item !== fallbackPropertyType), 1)]
          : sampleMany(propertyTypePool, 2);

    const existingLocalities = Array.isArray(user.preferredLocalities)
      ? user.preferredLocalities.map((item) => String(item || "").trim()).filter(Boolean)
      : Array.isArray(user.favoriteDestinations)
        ? user.favoriteDestinations.map((item) => String(item || "").trim()).filter(Boolean)
      : [];
    const resolvedLocalities = existingLocalities.length > 0 ? existingLocalities : sampleMany(localitiesPool, 3);

    const resolvedBudgetMin = Number.isFinite(Number(user.budgetMin)) ? Math.max(0, Number(user.budgetMin)) : 2500000;
    const resolvedBudgetMax = Number.isFinite(Number(user.budgetMax))
      ? Math.max(resolvedBudgetMin, Number(user.budgetMax))
      : resolvedBudgetMin + 7500000;
    const resolvedIntent = String(user.listingIntent || "").trim() || (resolvedPrimaryRole === "Tenant" ? "Rent" : "Buy");

    const currentBio = String(user.bio || "").trim();
    const shouldRewriteBio = !currentBio || /learn|language|fluency|practice|trip|travel/gi.test(currentBio);
    const resolvedBio = shouldRewriteBio
      ? buildRealEstateBio(user.fullName, resolvedCity, resolvedPrimaryRole, resolvedPropertyTypes)
      : currentBio;

    const updateDoc = {
      primaryRole: resolvedPrimaryRole,
      userRoles: resolvedRoles,
      city: resolvedCity,
      preferredLocalities: resolvedLocalities,
      propertyTypePreferences: resolvedPropertyTypes,
      budgetMin: resolvedBudgetMin,
      budgetMax: resolvedBudgetMax,
      listingIntent: resolvedIntent,
      // Keep legacy fields in sync during migration window.
      homeBase: resolvedCity,
      location: resolvedCity,
      travelStyle: resolvedPrimaryRole,
      travelInterests: resolvedPropertyTypes,
      favoriteDestinations: resolvedLocalities,
      bio: resolvedBio,
      nativeLanguage: resolvedPropertyTypes[0] || String(user.nativeLanguage || "").trim(),
      learningLanguage: resolvedPrimaryRole,
      isOnboarded: true,
    };

    const hasChange =
      String(user.primaryRole || "") !== String(updateDoc.primaryRole || "") ||
      JSON.stringify(user.userRoles || []) !== JSON.stringify(updateDoc.userRoles || []) ||
      String(user.city || "") !== String(updateDoc.city || "") ||
      JSON.stringify(user.preferredLocalities || []) !== JSON.stringify(updateDoc.preferredLocalities || []) ||
      JSON.stringify(user.propertyTypePreferences || []) !== JSON.stringify(updateDoc.propertyTypePreferences || []) ||
      Number(user.budgetMin || 0) !== Number(updateDoc.budgetMin || 0) ||
      Number(user.budgetMax || 0) !== Number(updateDoc.budgetMax || 0) ||
      String(user.listingIntent || "") !== String(updateDoc.listingIntent || "") ||
      String(user.homeBase || "") !== String(updateDoc.homeBase || "") ||
      String(user.location || "") !== String(updateDoc.location || "") ||
      String(user.travelStyle || "") !== String(updateDoc.travelStyle || "") ||
      JSON.stringify(user.travelInterests || []) !== JSON.stringify(updateDoc.travelInterests || []) ||
      JSON.stringify(user.favoriteDestinations || []) !== JSON.stringify(updateDoc.favoriteDestinations || []) ||
      String(user.bio || "") !== String(updateDoc.bio || "") ||
      String(user.nativeLanguage || "") !== String(updateDoc.nativeLanguage || "") ||
      String(user.learningLanguage || "") !== String(updateDoc.learningLanguage || "") ||
      Boolean(user.isOnboarded) !== Boolean(updateDoc.isOnboarded);

    if (hasChange) {
      changedCount += 1;
      updates.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: updateDoc },
        },
      });
    }
  }

  if (updates.length > 0) {
    await User.bulkWrite(updates);
  }

  console.log("Real-estate migration completed.");
  console.log(`Total users scanned: ${users.length}`);
  console.log(`Users updated: ${changedCount}`);

  await mongoose.connection.close();
}

migrateUsersToMarketplace().catch(async (error) => {
  console.error("Real-estate migration failed:", error?.message || error);
  try {
    await mongoose.connection.close();
  } catch {
    // Ignore close errors during failure path.
  }
  process.exit(1);
});
