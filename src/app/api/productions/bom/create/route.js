import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/productions/bom/create
// Body: { product_code, items: [{ spare_id, spare_name, weight_percent, qty_in_product, spare_image, spare_type, make, model, spec }] }
export async function POST(req) {
  const payload = await getSessionPayload();
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { product_code, items } = body || {};

    if (!product_code || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "product_code and items required" }, { status: 400 });
    }

    const db = await getDbConnection();
    
    // Check if BOM already exists
    const [existing] = await db.execute(
      `SELECT id FROM bom WHERE product_code = ? AND status = 'active' LIMIT 1`,
      [product_code]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "BOM already exists for this product" }, { status: 409 });
    }

    // Normalize weights to 100%
    const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight_percent) || 0), 0);
    if (totalWeight === 0) {
      return NextResponse.json({ error: "Total weight cannot be zero" }, { status: 400 });
    }

    const normalizedItems = items.map(it => ({
      ...it,
      weight_percent: totalWeight > 0 ? ((Number(it.weight_percent) || 0) / totalWeight * 100) : 0
    }));

    await db.execute(
      `INSERT INTO bom (product_code, status, items_json, created_by)
       VALUES (?, 'active', ?, ?)`,
      [product_code, JSON.stringify(normalizedItems), payload.username || null]
    );

    return NextResponse.json({ success: true, message: "BOM created successfully" });
  } catch (e) {
    console.error("/api/productions/bom/create error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}