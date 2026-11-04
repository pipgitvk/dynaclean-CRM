import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import {
  appendItemWiseSalesDateFilter,
  ITEM_WISE_SALES_REPORT_FROM_WHERE,
} from "@/lib/itemWiseSalesReportSql";

/** GET: distinct line-item models (item_name) in item-wise sales report date range. */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const params = [];
    const dateFilter = appendItemWiseSalesDateFilter(from, to, params);

    const sql = `
      SELECT DISTINCT TRIM(qi.item_name) AS model
      ${ITEM_WISE_SALES_REPORT_FROM_WHERE}
        AND qi.item_name IS NOT NULL
        AND TRIM(qi.item_name) != ''
      ${dateFilter}
      ORDER BY model ASC
    `;

    const conn = await getDbConnection();
    const [rows] = await conn.execute(sql, params);
    const models = (Array.isArray(rows) ? rows : [])
      .map((r) => (r.model != null ? String(r.model).trim() : ""))
      .filter(Boolean);

    return NextResponse.json(models);
  } catch (error) {
    console.error("item-wise-sales models:", error);
    return NextResponse.json(
      { error: "Failed to load models", details: error.message },
      { status: 500 },
    );
  }
}
