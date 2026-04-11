import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

/** GET: distinct `neworder.created_by` for invoiced rows (same scope as item-wise-sales report). Query: from, to (YYYY-MM-DD). */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let dateFilter = "";
    const params = [];

    if (from && to) {
      dateFilter = "AND n.invoice_date BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      dateFilter = "AND n.invoice_date >= ?";
      params.push(from);
    }

    const sql = `
      SELECT DISTINCT TRIM(n.created_by) AS username
      FROM neworder n
      WHERE n.invoice_number IS NOT NULL
        AND n.invoice_number != ''
        AND n.created_by IS NOT NULL
        AND TRIM(n.created_by) != ''
      ${dateFilter}
      ORDER BY username ASC
    `;

    const conn = await getDbConnection();
    const [rows] = await conn.execute(sql, params);
    const usernames = (Array.isArray(rows) ? rows : [])
      .map((r) => (r.username != null ? String(r.username).trim() : ""))
      .filter(Boolean);

    return NextResponse.json(usernames);
  } catch (error) {
    console.error("item-wise-sales employees:", error);
    return NextResponse.json(
      { error: "Failed to load employees", details: error.message },
      { status: 500 },
    );
  }
}
