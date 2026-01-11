import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  const conn = await getDbConnection();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = `
    SELECT customer_id, first_name, phone, email, assigned_to, sales_representative, 
           date_created, products_interest
    FROM customers
    WHERE lead_campaign = 'social_media'
  `;

  const params = [];

  if (from && to) {
    const fromDateTime = `${from} 00:00:00`;
    const toDateTime = `${to} 23:59:59`;

    query += ` AND date_created BETWEEN ? AND ?`;
    params.push(fromDateTime, toDateTime);
  } else {
    // Default to today's leads (full day)
    query += ` AND date_created BETWEEN CURDATE() AND CONCAT(CURDATE(), ' 23:59:59')`;
  }

  query += ` ORDER BY date_created DESC`;

  const [rows] = await conn.execute(query, params);

  return NextResponse.json(rows);
}
