// src/app/api/installation-videos/manual-link/route.js
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { id, item_code, user_manual_link } = body || {};

    if ((!id && !item_code) || typeof user_manual_link !== "string") {
      return new Response(JSON.stringify({ error: "id or item_code and user_manual_link are required" }), { status: 400 });
    }

    const conn = await getDbConnection();
    // safety: create column if it doesn't exist
    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN IF NOT EXISTS user_manual_link VARCHAR(500) NULL DEFAULT NULL`
    );

    let sql = "";
    let params = [];

    if (id) {
      sql = "UPDATE products_list SET user_manual_link = ? WHERE id = ?";
      params = [user_manual_link.trim(), id];
    } else {
      sql = "UPDATE products_list SET user_manual_link = ? WHERE item_code = ?";
      params = [user_manual_link.trim(), item_code];
    }

    const [result] = await conn.execute(sql, params);
    if (result.affectedRows === 0) {
      return new Response(JSON.stringify({ success: false, message: "No matching product found" }), { status: 404 });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err) {
    console.error("/api/installation-videos/manual-link error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
