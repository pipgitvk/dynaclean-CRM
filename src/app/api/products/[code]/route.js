// import { getDbConnection } from "@/lib/db";


// export async function GET(req, { params }) {
//   const conn = await getDbConnection();
//   const [rows] = await conn.execute(
//     "SELECT * FROM products_list WHERE item_code = ? LIMIT 1",
//     [params.code]
//   );
//       // await conn.end();

//   if (rows.length === 0) return new Response("Not found", { status: 404 });
//   return Response.json(rows[0]);
// }

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
      "SELECT product_number, item_name, item_code, price_per_unit, gst_rate FROM products_list WHERE item_code LIKE ? OR item_name LIKE ? OR product_number LIKE ? LIMIT 10",
      [searchQuery, searchQuery, searchQuery]
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