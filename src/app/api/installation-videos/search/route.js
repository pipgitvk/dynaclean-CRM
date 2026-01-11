// src/app/api/products/search/route.js
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const { searchParams } = req.nextUrl ?? new URL(req.url, "http://localhost");
  const q = (searchParams.get("q") || "").trim();
  const onlyMissing = (searchParams.get("onlyMissing") || "").toLowerCase() === "true";

  try {
    const conn = await getDbConnection();

    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN IF NOT EXISTS installation_video_link VARCHAR(500) NULL DEFAULT NULL`
    );
    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN IF NOT EXISTS user_manual_link VARCHAR(500) NULL DEFAULT NULL`
    );
    await conn.execute(
      `ALTER TABLE products_list ADD COLUMN IF NOT EXISTS catalogue_link VARCHAR(500) NULL DEFAULT NULL`
    );

    const where = [];
    const params = [];
    if (q) {
      where.push("(item_name LIKE ? OR item_code LIKE ? OR specification LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (onlyMissing) {
      where.push("(installation_video_link IS NULL OR installation_video_link = '' or 	user_manual_link IS NULL OR 	user_manual_link = '' or 	catalogue_link IS NULL OR 	catalogue_link = ''  )");
    }

    const sql = `
      SELECT id, item_name, item_code, category, specification, product_image, installation_video_link, user_manual_link, catalogue_link
      FROM products_list
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY item_name ASC
      LIMIT 500
    `;

    const [rows] = await conn.execute(sql, params);
    return new Response(JSON.stringify({ items: rows }), { status: 200 });
  } catch (err) {
    console.error("/api/products/search error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}
