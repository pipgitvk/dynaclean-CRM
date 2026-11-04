import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  appendItemWiseSalesDateFilter,
  ITEM_WISE_SALES_REPORT_FROM_WHERE,
} from "@/lib/itemWiseSalesReportSql";

/** GET: distinct rep names + customer lead_source for report rows in date range. */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const params = [];
    const dateFilter = appendItemWiseSalesDateFilter(from, to, params);

    const sql = `
      SELECT DISTINCT username FROM (
        SELECT TRIM(COALESCE(NULLIF(TRIM(qr.emp_name), ''), n.created_by)) AS username
        ${ITEM_WISE_SALES_REPORT_FROM_WHERE}
          AND COALESCE(NULLIF(TRIM(qr.emp_name), ''), n.created_by) IS NOT NULL
          AND TRIM(COALESCE(NULLIF(TRIM(qr.emp_name), ''), n.created_by)) != ''
        ${dateFilter}
        UNION
        SELECT TRIM(c.lead_source) AS username
        ${ITEM_WISE_SALES_REPORT_FROM_WHERE}
          AND c.lead_source IS NOT NULL
          AND TRIM(c.lead_source) != ''
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
