import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const conn = await getDbConnection();

    let query = `
      SELECT 
        customer_id,
        first_name,
        last_name,
        email,
        phone,
        company
      FROM customers
    `;

    let params = [];

    if (search) {
      query += `
        WHERE 
          first_name LIKE ?
          OR last_name LIKE ?
          OR phone LIKE ?
          OR email LIKE ?
      `;

      const searchValue = `%${search}%`;
      params.push(searchValue, searchValue, searchValue, searchValue);
    }

    query += " ORDER BY first_name ASC LIMIT 20";

    const [rows] = await conn.execute(query, params);

    return NextResponse.json(rows);

  } catch (err) {
    console.error("❌ Fetch customers failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
