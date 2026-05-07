import { getDbConnection } from "@/lib/db";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import { rowToAttendanceRulesShape } from "@/lib/attendanceRulesDb";

/** Resolved rules for one user (only per-employee schedule from database, no fallback to defaults). */
export async function fetchMergedAttendanceRulesForUser(username) {
  const conn = await getDbConnection();
  await ensureEmployeeAttendanceScheduleTable();
  const [rows] = await conn.query(
    `SELECT * FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
    [username]
  );
  // Return only employee-specific schedule from database, null if not found
  return rows[0] ? rowToAttendanceRulesShape(rows[0]) : null;
}
