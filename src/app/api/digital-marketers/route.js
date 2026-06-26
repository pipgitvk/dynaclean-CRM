import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

// GET all digital marketers
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    const connection = await getDbConnection();
    
    let query = `
      SELECT username 
      FROM rep_list 
      WHERE userRole = 'DIGITAL MARKETER'
    `;
    
    const params = [];

    if (search.trim()) {
      query += ` AND username LIKE ?`;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern);
    }

    query += ` ORDER BY username ASC LIMIT 50`;

    const [rows] = await connection.execute(query, params);

    return NextResponse.json(
      {
        users: rows.map((row) => ({
          username: row.username,
          name: row.username,
        })),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to fetch digital marketers:", error);
    return NextResponse.json(
      { message: "Failed to fetch digital marketers.", error: error.message },
      { status: 500 }
    );
  }
}
