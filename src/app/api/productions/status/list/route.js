import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/productions/status/list - list production rows with product and progress
export async function GET() {
  try {
    const db = await getDbConnection();
    const [rows] = await db.execute(`
      SELECT 
        pr.id as production_id,
        pr.product_code,
        pr.expected_date,
        pr.status,
        pr.progress_percent,
        pr.created_by,
        p.item_name as product_name,
        p.product_image
      FROM production pr
      JOIN products_list p ON p.item_code = pr.product_code
      ORDER BY pr.created_at DESC
    `);
    return NextResponse.json(rows || []);
  } catch (e) {
    console.error("/api/productions/status/list error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST /api/productions/status/add - body: { product_code, qty, expected_date }
// NOTE: This now snapshots the BOM items_json into each production row (production.items_json)
export async function POST(req) {
  const payload = await getSessionPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { product_code, qty, expected_date } = body || {};
    const n = Number(qty) || 0;
    if (!product_code || n < 1) {
      return NextResponse.json({ error: "product_code and qty>=1 required" }, { status: 400 });
    }
    if (!expected_date) {
      return NextResponse.json({ error: "expected_date is required" }, { status: 400 });
    }

    const db = await getDbConnection();
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Load active BOM once and snapshot its items_json
      const [[bomRow]] = await conn.query(
        `SELECT id, items_json FROM bom WHERE product_code = ? AND status = 'active' LIMIT 1`,
        [product_code]
      );
      if (!bomRow) {
        await conn.rollback();
        return NextResponse.json({ error: "Active BOM not found for this product" }, { status: 400 });
      }

      // Ensure we have a JSON string to store (fallback to empty array)
      let itemsJson = "[]";
      try {
        const parsed = JSON.parse(bomRow.items_json || "[]");
        itemsJson = JSON.stringify(parsed || []);
      } catch {
        itemsJson = bomRow.items_json || "[]";
      }

      for (let i = 0; i < n; i++) {
        await conn.execute(
          `INSERT INTO production (product_code, items_json, expected_date, status, progress_percent, created_by)
           VALUES (?, ?, ?, 'planned', 0, ?)`,
          [product_code, itemsJson, expected_date, payload.username || null]
        );
      }

      await conn.commit();
      return NextResponse.json({ success: true });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error("/api/productions/status/add error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
