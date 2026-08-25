import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensurePaymentDeductionsTable } from "@/lib/ensurePaymentDeductionsTable";

export async function GET(req, { params }) {
  const { orderId } = await params;

  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    await ensurePaymentDeductionsTable();

    const [rows] = await conn.execute(
      `SELECT 
        id,
        order_id,
        deduction_type,
        remarks,
        amount,
        recorded_by,
        recorded_date,
        claimable,
        claim_status,
        claim_received_date
       FROM payment_deductions
       WHERE order_id = ?
       ORDER BY recorded_date DESC`,
      [orderId]
    );

    return NextResponse.json({
      success: true,
      deductions: rows || []
    });
  } catch (error) {
    console.error("Error fetching deductions:", error);
    return NextResponse.json(
      { error: "Server error", details: error.message },
      { status: 500 }
    );
  }
}
