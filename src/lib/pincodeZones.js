// lib/pincodeZones.js
/**
 * Array of zone rules. Order matters: first match wins.
 *
 * Each entry:
 * { type: "prefix"|"regex"|"fn", match: [...prefixes] | "regexString" | (pin) => boolean, zone: "Delhi"|"South"|"Other", baseDays: number }
 */

const PIN_ZONES = [
  // Delhi local: (example) any pincode starting with 11, 12, 13, 14 (adjust as needed)
  { type: "prefix", match: ["11", "12", "13", "14"], zone: "Delhi", baseDays: 2 },

  // South examples (e.g., Karnataka / Bangalore starts with 56,57)
  { type: "prefix", match: ["56", "57"], zone: "South", baseDays: 3 },

  // West / Maharashtra example (adjust)
  { type: "prefix", match: ["40", "41", "42"], zone: "West", baseDays: 4 },

  // Any pin starting with 70 (east)
  { type: "prefix", match: ["70"], zone: "East", baseDays: 4 },

  // Generic fallback is handled by API (Other -> baseDays 5)
];

export default PIN_ZONES;
