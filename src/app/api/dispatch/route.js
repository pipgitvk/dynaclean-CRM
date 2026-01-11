import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const tokenPayload = await getSessionPayload();
    if (!tokenPayload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const role = tokenPayload.role;
    if ((role !== "warehouse incharge" && role !== "WAREHOUSE INCHARGE") && (role !== "superadmin" && role !== "SUPERADMIN") && (role !== "team leader" && role !== "TEAM LEADER") && (role !== "admin" && role !== "ADMIN")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const quoteNumberParam = searchParams.get("quote_number");

    const conn = await getDbConnection();

    let quoteNumber = quoteNumberParam;
    if (!quoteNumber && orderId) {
      const [rows] = await conn.execute(
        `SELECT quote_number FROM neworder WHERE order_id = ? LIMIT 1`,
        [orderId]
      );
      if (rows && rows[0]) {
        quoteNumber = rows[0].quote_number;
      }
    }

    if (!quoteNumber) {
      return NextResponse.json({ success: true, data: [] });
    }

    const [dispatchRows] = await conn.execute(
      `SELECT id, quote_number, item_name, item_code, serial_no, remarks, photos, godown, accessories_checklist, created_at, updated_at
       FROM dispatch WHERE quote_number = ? ORDER BY id ASC`,
      [quoteNumber]
    );

    return NextResponse.json({ success: true, data: dispatchRows });
  } catch (e) {
    console.error("Dispatch GET error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}


