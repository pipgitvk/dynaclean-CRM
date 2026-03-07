import { getDbConnection } from "@/lib/db";

/**
 * Get list of usernames who report to the given manager (reporting_manager = managerUsername)
 * @param {string} managerUsername
 * @returns {Promise<string[]>} Array of usernames
 */
export async function getReportees(managerUsername) {
  if (!managerUsername) return [];
  try {
    const conn = await getDbConnection();
    const [columns] = await conn.execute(
      `SHOW COLUMNS FROM rep_list LIKE 'reporting_manager'`
    );
    if (columns.length === 0) return [];

    const [rows] = await conn.execute(
      `SELECT username FROM rep_list WHERE reporting_manager = ? AND status = 1`,
      [managerUsername]
    );
    return rows.map((r) => r.username);
  } catch (e) {
    return [];
  }
}

/**
 * Check if currentUser is the reporting manager of expenseOwner
 */
export async function isReportingManagerOf(managerUsername, employeeUsername) {
  const reportees = await getReportees(managerUsername);
  return reportees.includes(employeeUsername);
}
