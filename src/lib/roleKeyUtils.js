/**
 * Pure role string normalization — safe to import from Client Components.
 * (No DB / Node-only deps — keep it that way.)
 */
export function normalizeRoleKey(role) {
  if (role == null || role === "") return "";
  return String(role).trim().replace(/\s+/g, " ").toUpperCase();
}
