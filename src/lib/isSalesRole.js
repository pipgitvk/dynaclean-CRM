export function isSalesRole(role) {
  const roleKey = String(role || "").trim().toUpperCase();
  return (
    roleKey === "SALES" ||
    roleKey === "SALES EXECUTIVE" ||
    roleKey === "SALES REPRESENTATIVE" ||
    roleKey === "SALES CUM BACKOFFICE" ||
    roleKey.includes("SALES")
  );
}
