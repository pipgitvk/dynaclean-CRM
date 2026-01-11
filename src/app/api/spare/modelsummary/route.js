import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  try {
    const [rows] = await conn.execute(`
      SELECT 
        sl.*,
        spl.spare_number,
        spl.item_name AS spare_name,
        ss.last_updated_quantity
      FROM stock_list sl
      LEFT JOIN spare_list spl ON sl.spare_id = spl.id
      LEFT JOIN stock_summary ss ON sl.spare_id = ss.spare_id
      ORDER BY sl.updated_at DESC
    `);

    console.log("All stock_list data fetched with spare_number, specification, and summary details:", rows.length, "records found");
    console.log("__________________________________________");
    console.log("Stock Data:", rows);
    
    return Response.json(rows);
  } catch (error) {
    console.error("Database error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch stock data." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    if (conn) {
          // await conn.end();
    }
    
  }
}