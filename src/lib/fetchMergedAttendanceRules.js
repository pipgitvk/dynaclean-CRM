import { getDbConnection } from "@/lib/db";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import { rowToAttendanceRulesShape } from "@/lib/attendanceRulesDb";
import { DEFAULT_ATTENDANCE_RULES } from "@/lib/attendanceRulesEngine";

/** Resolved rules for one user (per-employee schedule with DEFAULT rules as fallback). */
export async function fetchMergedAttendanceRulesForUser(username) {
  const conn = await getDbConnection();
  await ensureEmployeeAttendanceScheduleTable();
  const [rows] = await conn.query(
    `SELECT * FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
    [username]
  );
  // Return employee-specific schedule, or DEFAULT rules if not found
  return rows[0] ? rowToAttendanceRulesShape(rows[0]) : DEFAULT_ATTENDANCE_RULES;
}
