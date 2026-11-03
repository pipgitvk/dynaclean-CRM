
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");

  if (!q || q.length < 2) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const conn = await getDbConnection();
  try {
    const searchQuery = `%${q}%`;
    const [rows] = await conn.execute(
      `SELECT sl.id, sl.spare_number, sl.item_name, sl.specification, sl.type, sl.make, sl.model,
              sl.compatible_machine, sl.tax, sl.purchase_price, sl.sale_price, sl.last_negotiation_price, sl.image,
              COALESCE(ss.total_quantity, 0) AS total_quantity,
              COALESCE(ss.Delhi, 0) AS delhi_qty,
              COALESCE(ss.South, 0) AS south_qty
       FROM spare_list sl
       LEFT JOIN stock_summary ss ON ss.spare_id = sl.id
       WHERE sl.item_name LIKE ? OR sl.spare_number LIKE ?
       LIMIT 15`,
      [searchQuery, searchQuery]
    );

    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Database error:", error);
    return new Response("Internal Server Error", { status: 500 });
  } finally {
        // await conn.end();
  }
}