// /api/service/[service_id]/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(req, { params }) {
  const { service_id } = params;
  try {
    const connection = await getDbConnection();
    const [rows] = await connection.execute(
      `SELECT s.*, c.first_name, c.phone, c.address
       FROM services AS s
       LEFT JOIN customers AS c ON s.customer_id = c.customer_id
       WHERE s.service_id = ?`,
      [service_id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET service error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
