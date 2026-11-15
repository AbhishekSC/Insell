import * as repo from "./neighbourhoodSafety.repository.js";
import { computeNeighborhoodVibe } from "../../utils/neighborhoodVibeService.js";
import { fetchNearbyEmergencyFacilities } from "../../utils/neighborhoodVibeService.js";

export async function getDistrictSafetyInsights(district, state) {
  const records = await repo.findCrimeDataByDistrict(district, state);

  if (!records.length) {
    return { found: false, district, message: "No crime data available for this district" };
  }

  const latest = records[0];
  const oldest = records[records.length - 1];
  const yearRange = { from: oldest.year, to: latest.year };

  const trend = computeTrend(records);
  const safetyGrade = computeSafetyGrade(latest);

  return {
    found: true,
    district: latest.districtName,
    state: latest.stateName,
    yearRange,
    latestYear: latest.year,
    latestCrimes: latest.crimes,
    safetyGrade,
    trend,
    yearlyData: records.map((r) => ({
      year: r.year,
      total: r.crimes.total,
      kidnapping: r.crimes.kidnappingAndAbduction,
      assault: r.crimes.assaultOnWomen,
      cruelty: r.crimes.crueltyByHusband,
    })),
  };
}

export async function getSafetyOverview(latitude, longitude, locality, city, district, state) {
  const [crimeInsights, facilities] = await Promise.all([
    district ? getDistrictSafetyInsights(district, state) : Promise.resolve(null),
    fetchNearbyEmergencyFacilities(latitude, longitude),
  ]);

  return {
    crimeData: crimeInsights,
    emergencyFacilities: facilities,
    locality: locality || city || "Unknown",
  };
}

function computeTrend(records) {
  if (records.length < 2) return { direction: "stable", changePercent: 0 };

  const latest = records[0];
  const previous = records[1];
  if (!previous.crimes.total) return { direction: "stable", changePercent: 0 };

  const change = ((latest.crimes.total - previous.crimes.total) / previous.crimes.total) * 100;
  const direction = change > 5 ? "increasing" : change < -5 ? "decreasing" : "stable";

  return {
    direction,
    changePercent: Math.round(Math.abs(change)),
    fromYear: previous.year,
    toYear: latest.year,
  };
}

function computeSafetyGrade(record) {
  const total = record.crimes.total || 0;
  if (total <= 200) return { grade: "A", label: "Very Safe", color: "emerald" };
  if (total <= 500) return { grade: "B", label: "Generally Safe", color: "green" };
  if (total <= 1000) return { grade: "C", label: "Moderate Concern", color: "yellow" };
  if (total <= 2000) return { grade: "D", label: "Elevated Risk", color: "orange" };
  return { grade: "E", label: "High Risk Zone", color: "red" };
}
