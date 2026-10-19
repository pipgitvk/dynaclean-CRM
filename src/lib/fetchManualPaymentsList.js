import { ensureManualPaymentReceivedTable } from "@/lib/ensureManualPaymentReceivedTable";

/** Same list + KPI stats as accounts-dashboard/manual-payments. */
export async function fetchManualPaymentsList(conn) {
  await ensureManualPaymentReceivedTable();

  const [rows] = await conn.execute(`
    SELECT
      mpp.*,
      COALESCE(SUM(mpr.amount), 0) AS total_received
    FROM manual_payment_pending mpp
    LEFT JOIN manual_payment_received mpr ON mpr.payment_id = mpp.id
    GROUP BY mpp.id
    ORDER BY mpp.created_at DESC
  `);

  const [statsRows] = await conn.execute(`
    SELECT 
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
      COUNT(CASE WHEN status = 'received' THEN 1 END) as received_count,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_amount,
      COALESCE(SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END), 0) as received_amount,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count
    FROM manual_payment_pending
  `);

  return { rows, stats: statsRows[0] ?? {} };
}
