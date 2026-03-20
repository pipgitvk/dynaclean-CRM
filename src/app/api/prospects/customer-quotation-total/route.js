import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canAccessProspectsRole } from "@/lib/prospectAccess";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !canAccessProspectsRole(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const customerId = String(searchParams.get("customer_id") ?? "").trim();
    if (!customerId) {
      return NextResponse.json({
        success: true,
        grand_total: null,
        quote_number: null,
      });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT quote_number, grand_total
       FROM quotations_records
       WHERE customer_id = ?
       ORDER BY quote_date DESC, created_at DESC
       LIMIT 1`,
      [customerId],
    );

    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({
        success: true,
        grand_total: null,
        quote_number: null,
      });
    }

    let grand_total = row.grand_total != null ? Number(row.grand_total) : null;
    if (grand_total != null && Number.isNaN(grand_total)) grand_total = null;

    return NextResponse.json({
      success: true,
      grand_total,
      quote_number: row.quote_number ?? null,
    });
  } catch (e) {
    console.error("customer-quotation-total:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
