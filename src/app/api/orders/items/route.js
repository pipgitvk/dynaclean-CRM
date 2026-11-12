import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { patQuotationItemFilterSql } from "@/lib/patQuotationItemFilters";
import { applyPatRevenueSalesBatteryDisplay } from "@/lib/patRevenueSalesQuotationItems";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quote_number = searchParams.get("quote_number");
    const patSection =
      searchParams.get("pat_section") ?? searchParams.get("patSection");

    if (!quote_number) {
      return NextResponse.json(
        { success: false, error: "quote_number is required" },
        { status: 400 }
      );
    }

    const sectionFilter = patQuotationItemFilterSql(patSection);
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT qi.id, qi.item_name, qi.item_code, qi.quantity, qi.unit,
              qi.price_per_unit, qi.taxable_price, qi.total_price, qi.total_taxable_amt
       FROM quotation_items qi
       WHERE TRIM(qi.quote_number) = TRIM(?)
       ${sectionFilter ? `AND (${sectionFilter})` : ""}
       ORDER BY qi.id ASC`,
      [quote_number]
    );

    const patSectionKey = String(patSection ?? "").trim();
    const items =
      patSectionKey === "revenue_sales"
        ? await applyPatRevenueSalesBatteryDisplay(conn, rows, patSectionKey)
        : rows;

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("GET /api/orders/items error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
