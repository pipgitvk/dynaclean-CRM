import { getDbConnection } from "@/lib/db";
import { NextResponse } from 'next/server';

export async function GET(req) {
  let pool;
  let connection;
  try {
    const { searchParams } = new URL(req.url);
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const employeeName = searchParams.get("employeeName");
    const demoStatus = searchParams.get("demo_status");

    // 1. Get the pool
    pool = await getDbConnection();
    // 2. Get a specific connection from the pool
    connection = await pool.getConnection();

    const [employeeRows] = await connection.execute("SELECT username FROM rep_list WHERE status = 1");

    let query = "SELECT * FROM demoregistration";
    const whereClause = [];
    const queryParams = [];

    if (dateFrom) {
      whereClause.push("demo_date_time >= ?");
      queryParams.push(`${dateFrom} 00:00:00`);
    }
    if (dateTo) {
      whereClause.push("demo_date_time <= ?");
      queryParams.push(`${dateTo} 23:59:59`);
    }
    if (employeeName) {
      whereClause.push("username = ?");
      queryParams.push(employeeName);
    }

    if (demoStatus) {
      if (demoStatus === "Pending") {
        whereClause.push("(demo_status IS NULL OR demo_status = '')");
      } else {
        whereClause.push("demo_status = ?");
        queryParams.push(demoStatus);
      }
    }

    if (whereClause.length > 0) {
      query += " WHERE " + whereClause.join(" AND ");
    }

    // Add default sorting if no sort is provided to keep results consistent
    query += " ORDER BY demo_date_time DESC";

    const [rows] = await connection.execute(query, queryParams);

    return NextResponse.json({ data: rows, employees: employeeRows }, { status: 200 });

  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  } finally {
    // 3. Now .release() will work because 'connection' is a proper connection object
    if (connection) connection.release();
  }
}