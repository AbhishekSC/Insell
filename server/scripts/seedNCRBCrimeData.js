import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../.env") });

import DistrictCrimeData from "../src/models/DistrictCrimeData.model.js";

const CSV_PATH = process.argv[2];
if (!CSV_PATH) {
  console.error("Usage: node scripts/seedNCRBCrimeData.js <path-to-csv>");
  process.exit(1);
}

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCSV(raw) {
  const lines = raw.split("\n").filter((l) => l.trim());
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

async function main() {
  const raw = fs.readFileSync(CSV_PATH, "utf-8");
  const rows = parseCSV(raw);

  console.log(`Parsed ${rows.length} rows from CSV`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  const records = rows.map((r) => {
    const num = (field) => parseInt(r[field]) || 0;
    const floatNum = (field) => parseFloat(r[field]) || 0;

    const rape = num("rape_women_above_18") + num("rape_girls_below_18");
    const kidnapping = num("kidnapping_and_abduction");
    const cruelty = num("cruelty_by_husband_or_his_relatives");
    const dowryDeaths = num("dowry_deaths");
    const assault = num("assault_on_womenabove_18") + num("assault_on_women_below_18");
    const sexualHarassment = floatNum("procuring_inducing_children_for_the_sake_of_prostitution");
    const stalking = 0;
    const childRape = num("child_rape");
    const pocso = num("sexual_assault_of_children") + num("use_of_child_for_pornography") + num("offences_of_pocso_act");
    const cyberCrimes = floatNum("publshng_or_transmitting_of_sexually_explicit_mtrl") + floatNum("other_women_centric_cyber_crimes");

    const total = rape + kidnapping + cruelty + dowryDeaths + assault + childRape + pocso + cyberCrimes;

    return {
      year: num("year"),
      stateName: r.state_name,
      districtName: r.district_name,
      stateNormalized: normalize(r.state_name),
      districtNormalized: normalize(r.district_name),
      crimes: {
        rape,
        kidnappingAndAbduction: kidnapping,
        crueltyByHusband: cruelty,
        dowryDeaths,
        assaultOnWomen: assault,
        sexualHarassment,
        stalking,
        childRape,
        pocso,
        cyberCrimes,
        total,
      },
    };
  });

  const BATCH_SIZE = 500;
  let upserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const ops = batch.map((r) => ({
      updateOne: {
        filter: {
          districtNormalized: r.districtNormalized,
          stateNormalized: r.stateNormalized,
          year: r.year,
        },
        update: { $set: r },
        upsert: true,
      },
    }));
    const result = await DistrictCrimeData.bulkWrite(ops, { ordered: false });
    upserted += result.upsertedCount + result.modifiedCount;
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
  }

  console.log(`Done. Total upserted/updated: ${upserted}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
