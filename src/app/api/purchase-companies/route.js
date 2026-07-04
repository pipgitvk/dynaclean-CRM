import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/purchase-companies
// Returns distinct companies from product_stock_request with purchase stats
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await getDbConnection();

    const [rows] = await conn.execute(`
      SELECT
        client_company_name                     AS company_name,
        COUNT(*)                                AS purchase_count,
        SUM(net_amount)                        AS total_amount,
        MAX(created_at)                        AS last_purchase_date
      FROM product_stock_request
      WHERE client_company_name IS NOT NULL AND client_company_name != ''
      GROUP BY client_company_name
      ORDER BY total_amount DESC
    `);

    return NextResponse.json({ success: true, companies: rows });
  } catch (err) {
    console.error("[purchase-companies GET]", err?.message);
    return NextResponse.json({ error: "DB error", detail: err?.message }, { status: 500 });
  }
}
