import { getSessionPayload } from "@/lib/auth";

const MACHINE_ATTENDANCE_ROLES = new Set([
  "SUPERADMIN",
  "HR HEAD",
  "HR",
  "HR EXECUTIVE",
  "JUNIOR HR EXECUTIVE",
  "HR RECRUITER",
  "ACCOUNTANT",
]);

export function canAccessMachineAttendance(role) {
  const r = String(role || "").trim().toUpperCase();
  return MACHINE_ATTENDANCE_ROLES.has(r);
}

export async function requireMachineAttendanceSession() {
  const payload = await getSessionPayload();
  if (!payload) {
    return { ok: false, status: 401, message: "Unauthorized." };
  }
  if (!canAccessMachineAttendance(payload.role)) {
    return { ok: false, status: 403, message: "Forbidden." };
  }
  return { ok: true, payload };
}
