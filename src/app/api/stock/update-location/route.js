import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, code, location } = await req.json();

    if (!type || !code || typeof location !== "string") {
      return NextResponse.json({ error: "type, code and location are required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    if (type === "product") {
      await conn.execute(
        `UPDATE product_stock
         SET location = ?
         WHERE id = (
           SELECT id FROM (
             SELECT id
             FROM product_stock
             WHERE product_code = ? AND stock_status = 'IN'
             ORDER BY updated_at DESC
             LIMIT 1
           ) as sub
         )`,
        [location, code]
      );
    } else if (type === "spare") {
      await conn.execute(
        `UPDATE stock_list
         SET location = ?
         WHERE id = (
           SELECT id FROM (
             SELECT id
             FROM stock_list
             WHERE spare_id = ? AND stock_status = 'IN'
             ORDER BY created_at DESC
             LIMIT 1
           ) as sub
         )`,
        [location, code]
      );
    } else {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Update storage location error:", e);
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
