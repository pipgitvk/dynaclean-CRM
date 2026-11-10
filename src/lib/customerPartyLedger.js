/** Party ledger lives under `/{dashboard}/accounting/ledger`. */
export function customerPartyLedgerHref(customerId, userRole) {
  const role = String(userRole ?? "").trim();
  const roleNorm = role.toUpperCase();
  const salesLedger =
    roleNorm.includes("SALES") &&
    role !== "SUPERADMIN" &&
    roleNorm !== "DIRECTOR";

  const dashboardPrefix = salesLedger ? "sales-dashboard" : "admin-dashboard";
  return `/${dashboardPrefix}/accounting/ledger?customerId=${encodeURIComponent(String(customerId))}`;
}

/** View-customer profile used for “back” from party ledger. */
export function customerViewDashboardBaseForLedgerBack(userRole) {
  const role = String(userRole ?? "").trim();
  const roleNorm = role.toUpperCase();
  if (role === "SUPERADMIN" || roleNorm === "DIRECTOR") {
    return "admin-dashboard";
  }
  if (roleNorm.includes("SALES")) {
    return "user-dashboard";
  }
  return "admin-dashboard";
}
