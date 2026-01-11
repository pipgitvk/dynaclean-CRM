// import { getDbConnection } from "@/lib/db";


// export async function GET(req) {
//   const { searchParams } = new URL(req.url);
//   const q = searchParams.get("q");

//   const conn = await getDbConnection();
//   const [rows] = await conn.execute(
//     "SELECT item_code FROM products_list WHERE item_code LIKE ? LIMIT 10",
//     [`%${q}%`]
//   );
//       // await conn.end();

//   return Response.json(rows.map((r) => r.item_code));
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
      "SELECT * FROM products_list WHERE item_code LIKE ? OR item_name LIKE ? OR product_number LIKE ? LIMIT 10",
      [searchQuery, searchQuery, searchQuery]
    );

    console.log("Search results:", rows);
    

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