import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json({ error: "Authentication token missing." }, { status: 401 });
    }

    let username;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username;
    } catch (error) {
      return NextResponse.json({ error: "Invalid or expired token." }, { status: 401 });
    }

    const db = await getDbConnection();

    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query = `
      SELECT 
        customer_id,
        date_created,
        lead_campaign,
        first_name,
        company,
        status,
        lead_source,
        assigned_to,
        sales_representative
      FROM customers
      WHERE assigned_to = ?
    `;
    const params = [username];

    if (from && to) {
      query += ` AND DATE(date_created) BETWEEN ? AND ?`;
      params.push(from, to);
    } else if (from) {
      query += ` AND DATE(date_created) >= ?`;
      params.push(from);
    } else if (to) {
      query += ` AND DATE(date_created) <= ?`;
      params.push(to);
    }

    query += ` ORDER BY date_created DESC`;

    const [rows] = await db.execute(query, params);

    return NextResponse.json({ data: rows });
  } catch (error) {
    console.error("/api/assigned-customers error:", error);
    return NextResponse.json({ error: "Failed to fetch assigned customers." }, { status: 500 });
  }
}


