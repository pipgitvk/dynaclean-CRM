import { normalizeRoleKey } from "@/lib/roleKeyUtils";

/** Admin + Account may edit Order Date / PO Date (`neworder.created_at`). */
export function canEditOrderPoDate(role) {
  const k = normalizeRoleKey(role || "");
  return k === "SUPERADMIN" || k === "ADMIN" || k === "ACCOUNTANT";
}

/** Parse YYYY-MM-DD from order create/edit payload. */
export function parseOrderPoDateInput(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return m[1];
}

/** MySQL DATETIME string for PO/order date (date-only at midnight). */
export function orderPoDateToMysqlDateTime(isoDate) {
  const parsed = parseOrderPoDateInput(isoDate);
  if (!parsed) return null;
  return `${parsed} 00:00:00`;
}
