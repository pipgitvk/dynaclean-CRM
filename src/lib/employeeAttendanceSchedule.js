import { getDbConnection } from "@/lib/db";
import { ensureEmployeeAttendanceScheduleTable } from "@/lib/ensureEmployeeAttendanceScheduleTable";
import { normalizeEmployeeScheduleRow } from "@/lib/employeeAttendanceScheduleUtils";

export {
  rowTimeToString,
  normalizeEmployeeScheduleRow,
  formatScheduleTimeLabel,
  DEFAULT_EMPLOYEE_SCHEDULE,
} from "@/lib/employeeAttendanceScheduleUtils";

/**
 * Load break/check-in rules from employee_attendance_schedule.
 * Server-only — do not import this file from client components.
 */
export async function getEmployeeAttendanceSchedule(username) {
  await ensureEmployeeAttendanceScheduleTable();
  const conn = await getDbConnection();

  if (username) {
    const [userRows] = await conn.execute(
      `SELECT * FROM employee_attendance_schedule WHERE username = ? LIMIT 1`,
      [username]
    );
    if (userRows[0]) {
      return {
        rules: normalizeEmployeeScheduleRow(userRows[0]),
        source: "employee",
      };
    }
  }

  const [adminRows] = await conn.execute(
    `SELECT * FROM employee_attendance_schedule WHERE username = 'admin' LIMIT 1`
  );
  if (adminRows[0]) {
    return {
      rules: normalizeEmployeeScheduleRow(adminRows[0]),
      source: "admin",
    };
  }

  return {
    rules: normalizeEmployeeScheduleRow(null),
    source: "default",
  };
}
