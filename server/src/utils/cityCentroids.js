// Approximate centre coordinates for the cities the marketplace sees most.
// Used to give a coordless post a rough location so it can appear in the
// "Near Me" feed — always flagged locationPrecision:"approx" so the UI shows
// "~12 km · Mumbai", never a fake-precise "12.4 km away".
//
// [longitude, latitude] — GeoJSON order.
export const CITY_CENTROIDS = {
  mumbai: [72.8777, 19.0760],
  "navi mumbai": [73.0297, 19.0330],
  thane: [72.9781, 19.2183],
  delhi: [77.1025, 28.7041],
  "new delhi": [77.2090, 28.6139],
  noida: [77.3910, 28.5355],
  "greater noida": [77.5040, 28.4744],
  gurgaon: [77.0266, 28.4595],
  gurugram: [77.0266, 28.4595],
  ghaziabad: [77.4538, 28.6692],
  faridabad: [77.3178, 28.4089],
  bengaluru: [77.5946, 12.9716],
  bangalore: [77.5946, 12.9716],
  hyderabad: [78.4867, 17.3850],
  secunderabad: [78.4983, 17.4399],
  chennai: [80.2707, 13.0827],
  kolkata: [88.3639, 22.5726],
  pune: [73.8567, 18.5204],
  "pimpri-chinchwad": [73.7997, 18.6298],
  ahmedabad: [72.5714, 23.0225],
  gandhinagar: [72.6369, 23.2156],
  surat: [72.8311, 21.1702],
  vadodara: [73.1812, 22.3072],
  rajkot: [70.8022, 22.3039],
  jaipur: [75.7873, 26.9124],
  jodhpur: [73.0243, 26.2389],
  udaipur: [73.7125, 24.5854],
  kota: [75.8648, 25.2138],
  lucknow: [80.9462, 26.8467],
  kanpur: [80.3319, 26.4499],
  agra: [78.0081, 27.1767],
  varanasi: [82.9739, 25.3176],
  prayagraj: [81.8463, 25.4358],
  allahabad: [81.8463, 25.4358],
  meerut: [77.7064, 28.9845],
  indore: [75.8577, 22.7196],
  bhopal: [77.4126, 23.2599],
  gwalior: [78.1828, 26.2183],
  jabalpur: [79.9864, 23.1815],
  ratlam: [75.0367, 23.3315],
  ujjain: [75.7885, 23.1765],
  nagpur: [79.0882, 21.1458],
  nashik: [73.7898, 19.9975],
  aurangabad: [75.3433, 19.8762],
  patna: [85.1376, 25.5941],
  ranchi: [85.3096, 23.3441],
  raipur: [81.6296, 21.2514],
  bhubaneswar: [85.8245, 20.2961],
  guwahati: [91.7362, 26.1445],
  chandigarh: [76.7794, 30.7333],
  ludhiana: [75.8573, 30.9010],
  amritsar: [74.8723, 31.6340],
  jalandhar: [75.5762, 31.3260],
  dehradun: [78.0322, 30.3165],
  kochi: [76.2673, 9.9312],
  cochin: [76.2673, 9.9312],
  thiruvananthapuram: [76.9366, 8.5241],
  kozhikode: [75.7804, 11.2588],
  coimbatore: [76.9558, 11.0168],
  madurai: [78.1198, 9.9252],
  tiruchirappalli: [78.7047, 10.7905],
  visakhapatnam: [83.2185, 17.6868],
  vijayawada: [80.6480, 16.5062],
  mysuru: [76.6394, 12.2958],
  mysore: [76.6394, 12.2958],
  mangaluru: [74.8560, 12.9141],
  goa: [73.8278, 15.4909],
  panaji: [73.8278, 15.4909],
};

// Returns [lon, lat] for a city name, or null. Tolerant of "Andheri, Mumbai",
// "Mumbai Suburban", trailing state, etc. by testing each known city as a
// substring of the normalised input.
export function centroidForCity(raw) {
  const s = String(raw || "").toLowerCase().trim();
  if (!s) return null;
  if (CITY_CENTROIDS[s]) return CITY_CENTROIDS[s];
  for (const [name, coords] of Object.entries(CITY_CENTROIDS)) {
    if (s.includes(name)) return coords;
  }
  return null;
}
