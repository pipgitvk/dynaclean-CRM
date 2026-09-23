export function isGemRole(role) {
  const roleKey = String(role || "").trim().toUpperCase();
  return roleKey === "GEM" || roleKey === "GEM PORTAL";
}
