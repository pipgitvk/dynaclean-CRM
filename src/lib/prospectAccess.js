/** Roles allowed to use admin Prospects module (pages + APIs). */
export function canAccessProspectsRole(role) {
  const r = String(role ?? "").toUpperCase().trim();
  return ["SUPERADMIN", "ADMIN", "SALES", "SALES HEAD"].includes(r);
}

export function isProspectsAdminRole(role) {
  const r = String(role ?? "").toUpperCase().trim();
  return r === "SUPERADMIN";
}

/** Sales / sales head — amount on add forms is driven by quotation × qty only (not manually edited). */
export function isProspectsSalesOnlyRole(role) {
  const r = String(role ?? "").toUpperCase().trim();
  return r === "SALES" || r === "SALES HEAD";
}
