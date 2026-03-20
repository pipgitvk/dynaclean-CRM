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
    const q = String(searchParams.get("q") ?? "").trim();
    if (q.length < 1) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const like = `%${q}%`;
    const conn = await getDbConnection();
    const prefix = `${q}%`;
    const [rows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, phone, company
       FROM customers
       WHERE customer_id LIKE ?
          OR phone LIKE ?
          OR first_name LIKE ?
          OR last_name LIKE ?
          OR company LIKE ?
       ORDER BY (customer_id LIKE ?) DESC, date_created DESC
       LIMIT 20`,
      [like, like, like, like, like, prefix],
    );

    const suggestions = (rows || []).map((row) => ({
      customer_id: row.customer_id,
      first_name: row.first_name || "",
      last_name: row.last_name || "",
      phone: row.phone || "",
      company: row.company || "",
    }));

    return NextResponse.json({ success: true, suggestions });
  } catch (e) {
    console.error("prospects customer-suggestions:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
