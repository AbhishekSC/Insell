// Turns the raw /amenities/nearby list (schools / hospitals / metro / malls
// with distances, from Geoapify) into a scannable neighbourhood summary +
// a 0-10 connectivity score. Pure, no fetching — feed it data already loaded
// on the page.

const TYPE_META = {
  metro: { emoji: "🚇", one: "transit stop", many: "transit stops" },
  schools: { emoji: "🏫", one: "school", many: "schools" },
  hospitals: { emoji: "🏥", one: "hospital", many: "hospitals" },
  malls: { emoji: "🛒", one: "mall", many: "malls" },
};

const WITHIN = 1000; // metres — "walkable" bucket for counts

function fmtDistance(m) {
  if (m == null) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

function connectivityScore({ transitDist, dailyKinds, densityWithin }) {
  let score = 0;

  // Transit proximity (0-4)
  if (transitDist != null) {
    if (transitDist <= 500) score += 4;
    else if (transitDist <= 1000) score += 3;
    else if (transitDist <= 2000) score += 2;
    else score += 1;
  }

  // Coverage of daily-need categories within walking distance (0-3)
  score += Math.min(3, dailyKinds);

  // Overall amenity density within 1 km (0-3)
  if (densityWithin >= 15) score += 3;
  else if (densityWithin >= 8) score += 2;
  else if (densityWithin >= 3) score += 1;

  return Math.max(0, Math.min(10, score));
}

function scoreLabel(score) {
  if (score >= 8) return "Excellent connectivity";
  if (score >= 6) return "Well connected";
  if (score >= 4) return "Moderately connected";
  if (score >= 1) return "Limited connectivity";
  return "Quiet area";
}

export function summarizeNeighbourhood(items = [], { locality, city } = {}) {
  const list = Array.isArray(items) ? items.filter((a) => a && a.type && a.distance != null) : [];
  if (list.length === 0) return null;

  const byType = {};
  for (const key of Object.keys(TYPE_META)) {
    const ofType = list.filter((a) => a.type === key).sort((a, b) => a.distance - b.distance);
    if (ofType.length === 0) continue;
    byType[key] = {
      nearest: ofType[0],
      nearestDistance: ofType[0].distance,
      countWithin: ofType.filter((a) => a.distance <= WITHIN).length,
      total: ofType.length,
    };
  }

  const transitDist = byType.metro?.nearestDistance ?? null;
  const dailyKinds = ["schools", "hospitals", "malls"].filter(
    (k) => byType[k] && byType[k].nearestDistance <= WITHIN
  ).length;
  const densityWithin = list.filter((a) => a.distance <= WITHIN).length;

  const score = connectivityScore({ transitDist, dailyKinds, densityWithin });

  // Factual, derived one-liner — no assumptions.
  const bits = [];
  if (byType.metro) bits.push(`transit ${fmtDistance(byType.metro.nearestDistance)} away`);
  const counts = ["schools", "hospitals", "malls"]
    .filter((k) => byType[k]?.countWithin > 0)
    .map((k) => {
      const n = byType[k].countWithin;
      return `${n} ${n === 1 ? TYPE_META[k].one : TYPE_META[k].many}`;
    });
  if (counts.length) bits.push(`${counts.join(", ")} within 1 km`);
  const place = [locality, city].filter(Boolean).join(", ");
  const blurb = bits.length
    ? `${place ? place + " — " : ""}${bits.join(" · ")}.`
    : place || null;

  const chips = Object.entries(byType).map(([key, v]) => ({
    key,
    emoji: TYPE_META[key].emoji,
    label:
      v.countWithin > 1
        ? `${fmtDistance(v.nearestDistance)} · ${v.countWithin} within 1 km`
        : fmtDistance(v.nearestDistance),
    title: TYPE_META[key].many,
  }));

  return { score, scoreLabel: scoreLabel(score), chips, blurb, place };
}
