/**
 * Helpers for EMPCRM hiring city dropdowns (options usually come from
 * /api/empcrm/hiring-cities-for-designation = superadmin HR targets).
 */

function normalizeCityKey(s) {
  return String(s).trim().toLowerCase();
}

/**
 * @param {string[] | null | undefined} allowedList
 * @param {string} raw
 * @returns {string} value for a controlled <select> (matches option casing when possible)
 */
export function canonicalHiringCityInList(allowedList, raw) {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const k = normalizeCityKey(t);
  const found = (allowedList || []).find((c) => normalizeCityKey(c) === k);
  return found ?? t;
}

/**
 * Deduplicated sorted options: API list plus current value if missing (legacy / free-text).
 * @param {string[] | null | undefined} allowedList
 * @param {string} currentRaw
 */
export function mergeHiringCityOptions(allowedList, currentRaw) {
  const base = (allowedList || []).map((c) => String(c).trim()).filter(Boolean);
  const t = String(currentRaw ?? "").trim();
  if (!t) {
    return [...new Set(base)].sort((a, b) => a.localeCompare(b, "en-IN", { sensitivity: "base" }));
  }
  if (base.some((b) => normalizeCityKey(b) === normalizeCityKey(t))) {
    return [...new Set(base)].sort((a, b) => a.localeCompare(b, "en-IN", { sensitivity: "base" }));
  }
  return [...new Set([...base, t])].sort((a, b) => a.localeCompare(b, "en-IN", { sensitivity: "base" }));
}
