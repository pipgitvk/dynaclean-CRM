// src/app/api/quotation-followup/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from 'next/server';

export async function GET(req) {
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const empName = searchParams.get("empName");

    connection = await getDbConnection();

    // Always fetch the employee list
    const [employees] = await connection.execute("SELECT username FROM rep_list where status = 1");

    // If no filters are provided, return just the employee list
    if (!startDate && !endDate && !empName) {
      return NextResponse.json({ employees: employees }, { status: 200 });
    }

    // Otherwise, build and execute the query for filtered data
    let query = `
      SELECT 
        t1.quote_number, 
        t1.quote_date, 
        t1.company_name, 
        t1.grand_total, 
        t1.emp_name, 
        t1.customer_id,
        t2.order_id
      FROM quotations_records AS t1
      LEFT JOIN neworder AS t2 ON t1.quote_number = t2.quote_number
    `;
    let whereClause = [];
    let queryParams = [];

    if (startDate) {
      whereClause.push("t1.quote_date >= ?");
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause.push("t1.quote_date <= ?");
      queryParams.push(endDate);
    }
    if (empName) {
      whereClause.push("t1.emp_name = ?");
      queryParams.push(empName);
    }

    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }
    
    query += " ORDER BY t1.quote_date DESC";

    const [rows] = await connection.execute(query, queryParams);

    // Process rows to add 'status'
    const processedRows = rows.map(row => ({
        ...row,
        status: row.order_id ? 'closed' : 'open'
    }));

    return NextResponse.json({ data: processedRows, employees: employees }, { status: 200 });

  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    console.log("Closing database connection");
    
  }
}