// src/app/api/spare/modelsummary/route.js

import { getDbConnection } from "@/lib/db";

export async function GET() {
  const conn = await getDbConnection();

  try {
    const [rows] = await conn.execute(`
      SELECT 
        ss.*,
        spl.item_name,
        spl.specification,
        spl.spare_number,
        spl.min_qty
      FROM stock_summary as ss
      LEFT JOIN spare_list as spl ON ss.spare_id = spl.id
      ORDER BY ss.updated_at DESC
    `);

    console.log("dfgsdrgsdfgsdfgsdf________________________________________________sdkrfsdiuhsihgsdfig");
    console.log("this is the stock status data:", rows);
    
    
    
    console.log("Stock status data fetched successfully:", rows.length, "records found");
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