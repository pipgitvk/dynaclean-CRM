import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  appendItemWiseSalesDateFilter,
  ITEM_WISE_SALES_REPORT_FROM_WHERE,
} from "@/lib/itemWiseSalesReportSql";

/** GET: distinct customer lead_source values (same row set as item-wise sales report). */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const params = [];
    const dateFilter = appendItemWiseSalesDateFilter(from, to, params);

    const sql = `
      SELECT DISTINCT TRIM(c.lead_source) AS lead_source
      ${ITEM_WISE_SALES_REPORT_FROM_WHERE}
        AND c.lead_source IS NOT NULL
        AND TRIM(c.lead_source) != ''
      ${dateFilter}
      ORDER BY lead_source ASC
    `;

    const conn = await getDbConnection();
    const [rows] = await conn.execute(sql, params);
    const leadSources = (Array.isArray(rows) ? rows : [])
      .map((r) => (r.lead_source != null ? String(r.lead_source).trim() : ""))
      .filter(Boolean);

    return NextResponse.json(leadSources);
  } catch (error) {
    console.error("item-wise-sales lead-sources:", error);
    return NextResponse.json(
      { error: "Failed to load lead sources", details: error.message },
      { status: 500 },
    );
  }
}
