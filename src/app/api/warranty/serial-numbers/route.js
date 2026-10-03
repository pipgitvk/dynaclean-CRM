import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  let conn;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    conn = await getDbConnection();

    let query = `
      SELECT DISTINCT 
        serial_number, 
        product_name, 
        model,
        customer_name,
        contact,
        email,
        customer_address
      FROM warranty_products
      WHERE serial_number IS NOT NULL AND serial_number != ''
    `;

    const params = [];

    if (search && search.trim()) {
      query += ` AND (serial_number LIKE ? OR product_name LIKE ? OR model LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    query += ` ORDER BY serial_number ASC LIMIT 50`;

    console.log("Executing query:", query, "with params:", params);
    const [results] = await conn.execute(query, params);
    console.log("Query results:", results);

    return NextResponse.json({
      success: true,
      data: results || [],
    });
  } catch (error) {
    console.error("Error fetching serial numbers:", error);
    return NextResponse.json(
      { error: "Failed to fetch serial numbers", details: error.message },
      { status: 500 }
    );
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("Error closing connection:", e);
      }
    }
  }
}
