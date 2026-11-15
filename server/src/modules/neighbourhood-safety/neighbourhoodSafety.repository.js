import DistrictCrimeData from "../../models/DistrictCrimeData.model.js";

function normalize(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findCrimeDataByDistrict(district, state) {
  const districtNorm = normalize(district);
  const query = { districtNormalized: districtNorm };
  if (state) query.stateNormalized = normalize(state);

  return DistrictCrimeData.find(query).sort({ year: -1 }).lean();
}

export async function findLatestCrimeData(district, state) {
  const districtNorm = normalize(district);
  const query = { districtNormalized: districtNorm };
  if (state) query.stateNormalized = normalize(state);

  return DistrictCrimeData.findOne(query).sort({ year: -1 }).lean();
}

export async function getDistrictList(state) {
  const match = state ? { stateNormalized: normalize(state) } : {};
  return DistrictCrimeData.distinct("districtName", match);
}

export async function bulkUpsertCrimeData(records) {
  const ops = records.map((r) => ({
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
  return DistrictCrimeData.bulkWrite(ops, { ordered: false });
}
