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
        COALESCE(i.customer_id, c.customer_id) AS customer_id,
        TRIM(i.customer_name) AS buyer_name,
        COUNT(*) AS invoice_count,
        SUM(i.grand_total) AS total_amount,
        SUM(COALESCE(i.cgst,0) + COALESCE(i.sgst,0) + COALESCE(i.igst,0)) AS total_tax,
        MAX(COALESCE(i.order_date, i.invoice_date)) AS last_invoice_date,
        MIN(COALESCE(i.order_date, i.invoice_date)) AS first_invoice_date
      FROM invoices i
      LEFT JOIN customers c ON LOWER(TRIM(CONCAT(c.first_name, ' ', COALESCE(c.last_name, '')))) = LOWER(TRIM(i.customer_name))
        OR LOWER(TRIM(c.first_name)) = LOWER(TRIM(i.customer_name))
      WHERE i.customer_name IS NOT NULL 
        AND TRIM(i.customer_name) != ''
        AND COALESCE(i.customer_id, c.customer_id) IS NOT NULL
      GROUP BY TRIM(i.customer_name), COALESCE(i.customer_id, c.customer_id)
      ORDER BY total_amount DESC
    `);

    return NextResponse.json({ success: true, buyers: rows });
  } catch (err) {
    console.error("[invoice-buyers GET]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
