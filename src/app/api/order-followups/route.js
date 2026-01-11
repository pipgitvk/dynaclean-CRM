// src/app/api/order-followups/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const created_by = searchParams.get("created_by");

    connection = await getDbConnection();

    // Build query with all data including amounts from quotations_records
    let query = `
      SELECT 
        o.order_id, 
        o.report_file, 
        o.po_file, 
        o.payment_proof, 
        o.booking_url,
        o.client_name, 
        o.contact, 
        o.email, 
        o.delivery_location,
        o.created_at, 
        o.einvoice_file, 
        o.booking_id,
        o.created_by,
        o.quote_number,
        c.customer_id,
        q.grand_total,
        q.subtotal
      FROM neworder AS o
      LEFT JOIN customers AS c 
        ON o.contact = c.phone COLLATE utf8mb4_general_ci
      LEFT JOIN quotations_records AS q
        ON o.quote_number = q.quote_number
    `;

    const whereClause = [];
    const queryParams = [];

    if (startDate) {
      whereClause.push("o.created_at >= ?");
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause.push("o.created_at <= ?");
      queryParams.push(endDate);
    }
    if (created_by) {
      whereClause.push("o.created_by = ?");
      queryParams.push(created_by);
    }

    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }

    query += " ORDER BY o.created_at DESC";

    const [rows] = await connection.execute(query, queryParams);

    // Get unique created_by values for filter dropdown
    const [created_byList] = await connection.execute(
      "SELECT DISTINCT created_by FROM neworder WHERE created_by IS NOT NULL AND created_by != '' ORDER BY created_by"
    );

    return NextResponse.json({ 
      data: rows, 
      created_byList: created_byList.map(item => item.created_by)
    }, { status: 200 });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    console.log("Closing database connection");
  }
}
