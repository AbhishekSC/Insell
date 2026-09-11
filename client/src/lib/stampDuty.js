// Static reference table of stamp duty + registration fee rates by Indian
// state. These are *published government rates*, not scraped/fabricated
// data — but they vary by exact municipal area, change with state budgets,
// and often carry gender/joint-ownership concessions this table can't fully
// capture. Always shown with a disclaimer; never treat as authoritative for
// an actual transaction.
//
// Rates are the common "male / general" urban rate. `womenRebatePct` is the
// typical stamp-duty discount for a sole female owner where the state
// publishes one (0 if none).
export const STAMP_DUTY_RATES = {
  maharashtra: { stampDutyPct: 6, registrationPct: 1, womenRebatePct: 1, registrationCap: 30000 },
  delhi: { stampDutyPct: 6, registrationPct: 1, womenRebatePct: 2 },
  karnataka: { stampDutyPct: 5, registrationPct: 1, womenRebatePct: 0 },
  "tamil nadu": { stampDutyPct: 7, registrationPct: 4, womenRebatePct: 0 },
  telangana: { stampDutyPct: 4, registrationPct: 0.5, womenRebatePct: 0, extraPct: 1.5, extraLabel: "transfer duty" },
  gujarat: { stampDutyPct: 4.9, registrationPct: 1, womenRebatePct: 0 },
  "west bengal": { stampDutyPct: 6, registrationPct: 1, womenRebatePct: 0 },
  rajasthan: { stampDutyPct: 6, registrationPct: 1, womenRebatePct: 1 },
  "uttar pradesh": { stampDutyPct: 7, registrationPct: 1, womenRebatePct: 1, womenRebateFlat: 10000 },
  "madhya pradesh": { stampDutyPct: 7.5, registrationPct: 3, womenRebatePct: 0 },
  punjab: { stampDutyPct: 7, registrationPct: 1, womenRebatePct: 2 },
  haryana: { stampDutyPct: 7, registrationPct: 1, womenRebatePct: 2 },
  kerala: { stampDutyPct: 8, registrationPct: 2, womenRebatePct: 0 },
  bihar: { stampDutyPct: 5.7, registrationPct: 1.9, womenRebatePct: 0.6 },
  odisha: { stampDutyPct: 5, registrationPct: 2, womenRebatePct: 2 },
  assam: { stampDutyPct: 8.25, registrationPct: 1, womenRebatePct: 0 },
  chandigarh: { stampDutyPct: 6, registrationPct: 1, womenRebatePct: 2 },
  goa: { stampDutyPct: 4, registrationPct: 1, womenRebatePct: 0 },
};

export const STAMP_DUTY_STATES = Object.keys(STAMP_DUTY_RATES);

// Compact city -> state map so the calculator can default sensibly instead
// of forcing every user to pick a state before seeing a number.
const CITY_STATE = {
  mumbai: "maharashtra", "navi mumbai": "maharashtra", thane: "maharashtra", pune: "maharashtra",
  nagpur: "maharashtra", nashik: "maharashtra", aurangabad: "maharashtra", ratlam: "madhya pradesh",
  indore: "madhya pradesh", bhopal: "madhya pradesh", gwalior: "madhya pradesh", jabalpur: "madhya pradesh",
  ujjain: "madhya pradesh", delhi: "delhi", "new delhi": "delhi", noida: "uttar pradesh",
  "greater noida": "uttar pradesh", ghaziabad: "uttar pradesh", lucknow: "uttar pradesh", kanpur: "uttar pradesh",
  agra: "uttar pradesh", varanasi: "uttar pradesh", prayagraj: "uttar pradesh", meerut: "uttar pradesh",
  gurgaon: "haryana", gurugram: "haryana", faridabad: "haryana", bengaluru: "karnataka", bangalore: "karnataka",
  mysuru: "karnataka", mysore: "karnataka", mangaluru: "karnataka", hyderabad: "telangana", secunderabad: "telangana",
  chennai: "tamil nadu", coimbatore: "tamil nadu", madurai: "tamil nadu", tiruchirappalli: "tamil nadu",
  ahmedabad: "gujarat", surat: "gujarat", vadodara: "gujarat", rajkot: "gujarat", gandhinagar: "gujarat",
  jaipur: "rajasthan", jodhpur: "rajasthan", udaipur: "rajasthan", kota: "rajasthan", kolkata: "west bengal",
  patna: "bihar", bhubaneswar: "odisha", guwahati: "assam", chandigarh: "chandigarh", ludhiana: "punjab",
  amritsar: "punjab", jalandhar: "punjab", kochi: "kerala", cochin: "kerala", thiruvananthapuram: "kerala",
  kozhikode: "kerala", goa: "goa", panaji: "goa",
};

export function stateForCity(city) {
  const s = String(city || "").toLowerCase().trim();
  if (!s) return null;
  if (CITY_STATE[s]) return CITY_STATE[s];
  for (const [c, state] of Object.entries(CITY_STATE)) {
    if (s.includes(c)) return state;
  }
  return null;
}

// { propertyValue, state, isSoleWoman } -> breakdown, or null if the state
// isn't in the table.
export function calculateStampDuty({ propertyValue, state, isSoleWoman = false }) {
  const rates = STAMP_DUTY_RATES[String(state || "").toLowerCase().trim()];
  const value = Number(propertyValue) || 0;
  if (!rates || value <= 0) return null;

  let stampDutyPct = rates.stampDutyPct;
  let flatRebate = 0;
  if (isSoleWoman) {
    stampDutyPct = Math.max(0, stampDutyPct - (rates.womenRebatePct || 0));
    flatRebate = rates.womenRebateFlat || 0;
  }

  const stampDutyAmount = Math.max(0, Math.round((value * stampDutyPct) / 100) - flatRebate);
  const extraAmount = rates.extraPct ? Math.round((value * rates.extraPct) / 100) : 0;
  let registrationAmount = Math.round((value * rates.registrationPct) / 100);
  if (rates.registrationCap) registrationAmount = Math.min(registrationAmount, rates.registrationCap);

  const total = stampDutyAmount + extraAmount + registrationAmount;

  return {
    state,
    stampDutyPct,
    stampDutyAmount,
    extraAmount,
    extraLabel: rates.extraLabel || null,
    registrationPct: rates.registrationPct,
    registrationAmount,
    registrationCapped: Boolean(rates.registrationCap) && Math.round((value * rates.registrationPct) / 100) > rates.registrationCap,
    total,
    grandTotal: value + total,
  };
}
