import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/productions/bom/list
// Returns products which have an active BOM
export async function GET() {
  try {
    const db = await getDbConnection();
    const [rows] = await db.execute(`
      SELECT 
        b.id AS bom_id,
        b.product_code,
        b.status AS bom_status,
        b.created_by,
        b.modified_by,
        p.item_name AS product_name,
        p.specification,
        p.product_image
      FROM bom b
      JOIN products_list p ON p.item_code = b.product_code
      WHERE b.status = 'active'
      ORDER BY b.id DESC
    `);
    return NextResponse.json(rows || []);
  } catch (e) {
    console.error("/api/productions/bom/list error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
