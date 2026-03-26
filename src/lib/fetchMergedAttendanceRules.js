import { getDbConnection } from "@/lib/db";
import { loadGlobalAttendanceRulesRow } from "@/lib/ensureAttendanceRulesTable";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import {
  rowToAttendanceRulesShape,
  mergeGlobalRulesWithEmployeeSchedule,
} from "@/lib/attendanceRulesDb";

/** Resolved rules for one user (global + optional per-employee row). */
export async function fetchMergedAttendanceRulesForUser(username) {
  const conn = await getDbConnection();
  const globalRow = await loadGlobalAttendanceRulesRow(conn);
  const globalRules = rowToAttendanceRulesShape(globalRow);
  await ensureEmployeeAttendanceScheduleTable();
  const [rows] = await conn.query(
    `SELECT * FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
    [username]
  );
  return mergeGlobalRulesWithEmployeeSchedule(globalRules, rows[0] || null);
}
