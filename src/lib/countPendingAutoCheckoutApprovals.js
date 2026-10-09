import { AUTO_CHECKOUT_ATTENDANCE_ADDRESS } from "@/lib/attendanceAutoCheckoutConstants";
import { ensureAttendanceAutoCheckoutApprovalsTable } from "@/lib/ensureAttendanceAutoCheckoutApprovalsTable";

/** Automatic check-outs waiting for HR approval (this month by default). */
export async function countPendingAutoCheckoutApprovals(conn, options = {}) {
  const { monthScope = true } = options;
  await ensureAttendanceAutoCheckoutApprovalsTable(conn);

  let monthSql = "";
  if (monthScope) {
    monthSql = `
      AND YEAR(a.date) = YEAR(CURDATE())
      AND MONTH(a.date) = MONTH(CURDATE())`;
  }

  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c
     FROM attendance_logs a
     LEFT JOIN attendance_auto_checkout_approvals ap
       ON ap.username = a.username AND ap.log_date = a.date
     WHERE TRIM(COALESCE(a.checkout_address, '')) = ?
       AND (ap.id IS NULL OR ap.status = 'pending')
     ${monthSql}`,
    [AUTO_CHECKOUT_ATTENDANCE_ADDRESS]
  );
  return Number(rows[0]?.c ?? 0);
}
