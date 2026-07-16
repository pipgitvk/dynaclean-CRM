import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET /api/assets/debug - Debug endpoint to check what's actually in the database
export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conn = await getDbConnection();

    // Get the latest assets with all fields related to categories
    const [assets] = await conn.execute(`
      SELECT 
        asset_id,
        type,
        asset_category,
        asset_name,
        brand_name,
        created_at
      FROM assets
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Also check what's in asset_categories
    const [categories] = await conn.execute(`
      SELECT id, category_name, category_type FROM asset_categories
      ORDER BY id DESC
    `);

    return NextResponse.json({
      success: true,
      latest_assets: assets,
      all_categories: categories,
    });
  } catch (err) {
    console.error("[assets/debug GET]", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
