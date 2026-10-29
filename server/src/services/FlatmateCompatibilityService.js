/**
 * Calculates a compatibility score (0–100) between a viewer's flatmate
 * profile and a flatmate post (FLATMATE_OFFER or FLATMATE_SEEKING).
 *
 * Scoring weights:
 *   Gender match        — 20 pts
 *   Budget overlap      — 20 pts
 *   Food preference     — 15 pts
 *   Smoking match       — 10 pts
 *   Drinking match      —  5 pts
 *   Pets compatibility  —  5 pts
 *   Occupation match    — 10 pts
 *   Work schedule       —  5 pts
 *   Cleanliness         —  5 pts
 *   Noise preference    —  5 pts
 *                Total: 100 pts
 */

function genderScore(viewerGender, postGenderPref) {
  if (!postGenderPref || postGenderPref === "Any") return 20;
  if (!viewerGender) return 10;
  return viewerGender === postGenderPref ? 20 : 0;
}

function budgetScore(viewerProfile, post, fm) {
  const postType = String(post.postType || "").toUpperCase();
  if (postType === "FLATMATE_OFFER") {
    const rent = fm.rentPerPerson || post.price || 0;
    if (!rent) return 10;
    const vMin = viewerProfile.budgetMin || 0;
    const vMax = viewerProfile.budgetMax || 0;
    if (!vMin && !vMax) return 10;
    const max = vMax || vMin * 2;
    const min = vMin || 0;
    if (rent >= min && rent <= max) return 20;
    if (rent < min) {
      const diff = (min - rent) / min;
      return diff < 0.3 ? 14 : 6;
    }
    const diff = (rent - max) / max;
    return diff < 0.2 ? 14 : diff < 0.5 ? 8 : 2;
  }
  if (postType === "FLATMATE_SEEKING") {
    const seekMin = fm.budgetMin || 0;
    const seekMax = fm.budgetMax || 0;
    if (!seekMin && !seekMax) return 10;
    const vMin = viewerProfile.budgetMin || 0;
    const vMax = viewerProfile.budgetMax || 0;
    if (!vMin && !vMax) return 10;
    const overlap = Math.min(vMax || Infinity, seekMax || Infinity) - Math.max(vMin, seekMin);
    return overlap >= 0 ? 20 : 6;
  }
  return 10;
}

function exactOrPartial(viewerVal, postVal, fullPts, partialPts = 0) {
  if (!viewerVal || !postVal) return Math.round(fullPts * 0.5);
  return viewerVal === postVal ? fullPts : partialPts;
}

function lifestyleTagScore(viewerProfile, postTags) {
  if (!Array.isArray(postTags) || postTags.length === 0) return 0;
  let bonus = 0;
  const lowerTags = postTags.map((t) => String(t).toLowerCase());

  if (viewerProfile.foodPreference === "veg" && lowerTags.includes("pure vegetarian")) bonus += 3;
  if (viewerProfile.occupation === "student" && lowerTags.includes("college student")) bonus += 2;
  if (viewerProfile.occupation === "working" && lowerTags.includes("working full time")) bonus += 2;

  return Math.min(5, bonus);
}

export function calculateFlatmateCompatibility(viewerProfile, post) {
  if (!viewerProfile || !viewerProfile.updatedAt) return null;
  const fm = post.postMeta?.flatmate || {};

  let score = 0;

  score += genderScore(viewerProfile.gender, fm.genderPreference);

  score += budgetScore(viewerProfile, post, fm);

  score += exactOrPartial(viewerProfile.foodPreference, fm.lifestyleTags?.find((t) =>
    ["veg", "nonveg", "eggetarian", "pure vegetarian", "non-vegetarian"].includes(String(t).toLowerCase())
  ) ? viewerProfile.foodPreference : null, 15, 5);
  if (!fm.lifestyleTags?.length) {
    score += 8;
  }

  score += exactOrPartial(viewerProfile.smoking, fm.lifestyleTags?.some((t) =>
    String(t).toLowerCase().includes("no smoking") || String(t).toLowerCase().includes("non-smoker")
  ) ? "no" : null, 10, 3);
  if (!fm.lifestyleTags?.length) {
    score += 5;
  }

  score += exactOrPartial(viewerProfile.drinking, null, 5);

  score += exactOrPartial(viewerProfile.pets, fm.lifestyleTags?.some((t) =>
    String(t).toLowerCase().includes("pet")
  ) ? "yes" : "no", 5, 2);
  if (!fm.lifestyleTags?.length) {
    score += 3;
  }

  const postOccupation = fm.targetAudience?.some((t) =>
    String(t).toLowerCase().includes("working")
  ) ? "working" : fm.targetAudience?.some((t) =>
    String(t).toLowerCase().includes("student")
  ) ? "student" : null;
  score += exactOrPartial(viewerProfile.occupation, postOccupation, 10, 3);

  score += exactOrPartial(viewerProfile.workSchedule, null, 5);
  score += exactOrPartial(viewerProfile.cleanliness, null, 5);
  score += exactOrPartial(viewerProfile.noisePreference, null, 5);

  score += lifestyleTagScore(viewerProfile, [...(fm.lifestyleTags || []), ...(fm.targetAudience || [])]);

  return Math.min(100, Math.max(0, Math.round(score)));
}

export default { calculateFlatmateCompatibility };
