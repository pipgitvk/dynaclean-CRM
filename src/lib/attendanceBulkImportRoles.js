/**
 * Client-safe role check for HR bulk attendance import.
 * No DB / Node-only deps — do not import @/lib/db here.
 * Keep in sync with /api/empcrm/attendance/import.
 */
import { normalizeRoleKey } from "./roleKeyUtils";

const BULK_IMPORT_ATTENDANCE_ROLES = new Set(
  [
    "SUPERADMIN",
    "ADMIN",
    "HR HEAD",
    "HR",
    "HR Executive",
    "ACCOUNTANT",
  ].map((r) => normalizeRoleKey(r))
);

export function canBulkImportAttendance(role) {
  return BULK_IMPORT_ATTENDANCE_ROLES.has(normalizeRoleKey(role));
}
