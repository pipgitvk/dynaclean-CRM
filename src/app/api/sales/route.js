import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const conn = await getDbConnection();

    const { searchParams } = new URL(req.url);
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    let query = `
      SELECT 
        qi.item_name as product_name,
        qi.item_code as product_code,
        qi.item_code as specification,
        qi.taxable_price as price_per_unit,
        qi.quantity,
        no.totalamt as net_amount,
        qr.quote_number,
        no.order_id,
        no.client_name,
        no.created_at
      FROM quotation_items qi
      LEFT JOIN quotations_records qr ON qi.quote_number = qr.quote_number
      LEFT JOIN neworder no ON qi.quote_number = no.quote_number
      WHERE no.approval_status = 'approved'
    `;

    const params = [];
    if (fromDate) {
      query += ` AND DATE(no.created_at) >= ?`;
      params.push(fromDate);
    }
    if (toDate) {
      query += ` AND DATE(no.created_at) <= ?`;
      params.push(toDate);
    }

    query += ` ORDER BY no.created_at DESC`;

    const [rows] = await conn.execute(query, params);
    // await conn.end();

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching sales data:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
