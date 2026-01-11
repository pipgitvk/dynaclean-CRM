// src/app/api/products/with-video/route.js
import { getDbConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  // Use NextRequest.nextUrl to avoid relative URL issues in some runtimes
  const { searchParams } = req.nextUrl ?? new URL(req.url, "http://localhost");
  const q = (searchParams.get("q") || "").trim();
  const category = (searchParams.get("category") || "").trim();

  try {
    const conn = await getDbConnection();

    const where = [
      "installation_video_link IS NOT NULL ",
      "installation_video_link <> '' ",
      "user_manual_link IS NOT NULL ",
      "user_manual_link <> '' ",
      "catalogue_link IS NOT NULL ",
      "catalogue_link <> '' "
    ];
    const params = [];

    if (q) {
      where.push("(item_name LIKE ? OR item_code LIKE ? OR specification LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    if (category) {
      where.push("category = ?");
      params.push(category);
    }

    const sql = `
      SELECT 
        id,
        item_name,
        item_code,
        category,
        specification,
        product_image,
        installation_video_link,
        user_manual_link,
        catalogue_link
      FROM products_list
      ${where.length ? "WHERE " + where.join(" or ") : ""}
      ORDER BY item_name ASC
      LIMIT 500
    `;

    const [rows] = await conn.execute(sql, params);

    // Also return distinct categories (for filters)
    const [catRows] = await conn.execute(
      `SELECT DISTINCT category FROM products_list WHERE (installation_video_link IS NOT NULL AND installation_video_link <> '') or (	user_manual_link IS NOT NULL AND 	user_manual_link <> '') or  (	catalogue_link IS NOT NULL AND 	catalogue_link <> '')   ORDER BY category`
    );

    return new Response(
      JSON.stringify({ items: rows, categories: catRows.map((r) => r.category).filter(Boolean) }),
      { status: 200 }
    );
  } catch (err) {
    console.error("/api/products/with-video error:", err);
    return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
  }
}