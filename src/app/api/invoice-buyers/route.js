import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/invoice-buyers
// Returns distinct buyers with invoice stats
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await getDbConnection();

    const [rows] = await conn.execute(`
      SELECT
        customer_name                           AS buyer_name,
        COUNT(*)                                AS invoice_count,
        SUM(grand_total)                        AS total_amount,
        SUM(COALESCE(cgst,0) + COALESCE(sgst,0) + COALESCE(igst,0)) AS total_tax,
        MAX(COALESCE(order_date, invoice_date)) AS last_invoice_date,
        MIN(COALESCE(order_date, invoice_date)) AS first_invoice_date
      FROM invoices
      WHERE customer_name IS NOT NULL AND customer_name != ''
      GROUP BY customer_name
      ORDER BY total_amount DESC
    `);

    return NextResponse.json({ success: true, buyers: rows });
  } catch (err) {
    console.error("[invoice-buyers GET]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
