import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit")) || 10;

    const conn = await getDbConnection();

    let sql = `
      SELECT 
        customer_id,
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) as customer_name,
        first_name,
        last_name,
        phone,
        email,
        address,
        company,
        state
      FROM customers 
      WHERE 1=1
    `;

    const params = [];

    if (query.trim()) {
      sql += ` AND (
        CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) LIKE ? OR 
        first_name LIKE ? OR
        last_name LIKE ? OR
        company LIKE ? OR
        phone LIKE ? OR 
        email LIKE ? OR
        customer_id LIKE ?
      )`;
      const searchTerm = `%${query.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
      sql += ` ORDER BY first_name ASC LIMIT ?`;
    } else {
      // For empty search, show recent customers
      sql += ` ORDER BY date_created DESC LIMIT ?`;
    }
    params.push(limit);

    const [rows] = await conn.execute(sql, params);

    return NextResponse.json({
      success: true,
      data: rows || [],
    });
  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}