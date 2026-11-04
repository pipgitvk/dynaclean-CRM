import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  ITEM_WISE_SALES_ORDER_ELIGIBILITY,
  ITEM_WISE_QUOTATION_RECORDS_JOIN,
} from "@/lib/itemWiseSalesReportSql";

/** GET: distinct sales usernames for approved orders in range (created_by + quotation emp_name). */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let dateFilter = "";
    const params = [];

    if (from && to) {
      dateFilter = "AND DATE(n.created_at) BETWEEN ? AND ?";
      params.push(from, to);
    } else if (from) {
      dateFilter = "AND DATE(n.created_at) >= ?";
      params.push(from);
    }

    const sql = `
      SELECT DISTINCT username FROM (
        SELECT TRIM(n.created_by) AS username
        FROM neworder n
        ${ITEM_WISE_QUOTATION_RECORDS_JOIN}
        WHERE ${ITEM_WISE_SALES_ORDER_ELIGIBILITY}
          AND n.created_by IS NOT NULL
          AND TRIM(n.created_by) != ''
        ${dateFilter}
        UNION
        SELECT TRIM(qr.emp_name) AS username
        FROM neworder n
        ${ITEM_WISE_QUOTATION_RECORDS_JOIN}
        WHERE ${ITEM_WISE_SALES_ORDER_ELIGIBILITY}
          AND qr.emp_name IS NOT NULL
          AND TRIM(qr.emp_name) != ''
        ${dateFilter}
      ) u
      WHERE username IS NOT NULL AND username != ''
      ORDER BY username ASC
    `;

    const conn = await getDbConnection();
    const queryParams = dateFilter ? [...params, ...params] : params;
    const [rows] = await conn.execute(sql, queryParams);
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
