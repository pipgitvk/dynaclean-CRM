import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const quote_number = searchParams.get("quote_number");

    if (!quote_number) {
      return NextResponse.json(
        { success: false, error: "quote_number is required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();
    const [items] = await conn.execute(
      `SELECT id, item_name, item_code, quantity, 
              total_price, taxable_price, total_taxable_amt
       FROM quotation_items 
       WHERE quote_number = ?
       ORDER BY id ASC`,
      [quote_number]
    );

    return NextResponse.json({ success: true, items });
  } catch (err) {
    console.error("GET /api/orders/items error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
