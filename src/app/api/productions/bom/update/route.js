// src/app/api/productions/bom/update/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { product_code, items } = await req.json();
    if (!product_code || !Array.isArray(items)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const db = await getDbConnection();
    const [exists] = await db.execute(`SELECT id FROM bom WHERE product_code = ?`, [product_code]);
    if (exists.length === 0) return NextResponse.json({ error: "BOM not found" }, { status: 404 });

    const json = JSON.stringify(items);
    await db.execute(
      `UPDATE bom SET items_json = ?, modified_by = ?, updated_at = NOW() WHERE product_code = ?`,
      [json, payload.username || null, product_code]
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /productions/bom/update error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
