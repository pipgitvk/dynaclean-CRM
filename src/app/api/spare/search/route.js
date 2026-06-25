
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
      "SELECT id, spare_number, item_name, specification, image, compatible_machine FROM `spare_list` WHERE item_name LIKE ? OR spare_number LIKE ? LIMIT 15",
      [searchQuery, searchQuery]
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