// src/app/api/products/video-link/route.js
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, item_code, installation_video_link } = body || {};

    if ((!id && !item_code) || typeof installation_video_link !== "string") {
      return new Response(JSON.stringify({ error: "id or item_code and installation_video_link are required" }), { status: 400 });
    }

    const conn = await getDbConnection();
    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN IF NOT EXISTS installation_video_link VARCHAR(500) NULL DEFAULT NULL`
    );

    let sql = "";
    let params = [];

    if (id) {
      sql = "UPDATE products_list SET installation_video_link = ? WHERE id = ?";
      params = [installation_video_link.trim(), id];
    } else {
      sql = "UPDATE products_list SET installation_video_link = ? WHERE item_code = ?";
      params = [installation_video_link.trim(), item_code];
    }

    const [result] = await conn.execute(sql, params);
    if (result.affectedRows === 0) {
      return new Response(JSON.stringify({ success: false, message: "No matching product found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/products/video-link error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
