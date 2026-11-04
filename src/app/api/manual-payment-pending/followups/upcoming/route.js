import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureManualPaymentFollowupsTable } from "@/lib/ensureManualPaymentFollowupsTable";
import { ensureManualPaymentReceivedTable } from "@/lib/ensureManualPaymentReceivedTable";
import { userHasManualPaymentsModuleAccess } from "@/lib/userModuleAccessServer";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasAccess = await userHasManualPaymentsModuleAccess(
      payload.username,
      payload.role ?? payload.userRole,
    );
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await ensureManualPaymentFollowupsTable();
    await ensureManualPaymentReceivedTable();
    const conn = await getDbConnection();

    const [rows] = await conn.execute(
      `SELECT
         mf.id,
         mf.payment_id,
         mf.customer_name,
         mf.customer_phone,
         mf.next_followup_date,
         mf.notes,
         mf.created_at,
         mpp.amount,
         mpp.status AS payment_status,
         mpp.customer_name AS payment_customer_name,
         COALESCE(recv.total_received, 0) AS total_received
       FROM manual_payment_followups mf
       INNER JOIN manual_payment_pending mpp ON mpp.id = mf.payment_id
       LEFT JOIN (
         SELECT payment_id, COALESCE(SUM(amount), 0) AS total_received
         FROM manual_payment_received
         GROUP BY payment_id
       ) recv ON recv.payment_id = mpp.id
       INNER JOIN (
         SELECT payment_id, MAX(id) AS max_id
         FROM manual_payment_followups
         WHERE created_by = ?
           AND next_followup_date IS NOT NULL
         GROUP BY payment_id
       ) latest ON latest.max_id = mf.id
       WHERE mf.created_by = ?
         AND LOWER(TRIM(COALESCE(mpp.status, ''))) <> 'received'
         AND LOWER(TRIM(COALESCE(mpp.status, ''))) <> 'cancelled'
         AND (
           COALESCE(mpp.amount, 0) <= 0
           OR COALESCE(recv.total_received, 0) < COALESCE(mpp.amount, 0)
         )
       ORDER BY mf.next_followup_date ASC
       LIMIT 50`,
      [payload.username, payload.username],
    );

    return NextResponse.json({ success: true, followups: rows || [] });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error", details: error?.message },
      { status: 500 },
    );
  }
}
