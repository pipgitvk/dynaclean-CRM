import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// GET - Fetch lead source options for bulk reassign
export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = String(searchParams.get("type") || "sales").toLowerCase();
    const connection = await getDbConnection();
    let employees = [];

    if (type === "service") {
      const [rows] = await connection.execute(
        `SELECT username, username AS name
         FROM rep_list
         WHERE userRole IN ('SERVICE HEAD', 'SERVICE SUPPORT') AND status = 1
         ORDER BY username ASC`,
      );
      employees = rows;
    } else if (type === "gem") {
      const [rows] = await connection.execute(
        `SELECT username, username AS name
         FROM rep_list
         WHERE userRole = 'GEM' AND status = 1
         ORDER BY username ASC`,
      );
      employees = rows;
    } else {
      const [rows] = await connection.execute(
        `SELECT username, username AS name
         FROM rep_list
         WHERE userRole IN ('SALES', 'SALES CUM BACKOFFICE', 'SALES HEAD', 'SALES EXECUTIVE', 'SALES REPRESENTATIVE')
           AND status = 1
         ORDER BY username ASC`,
      );
      employees = rows;
    }

    return NextResponse.json({ success: true, employees, type });
  } catch (error) {
    console.error("Error fetching lead sources:", error);
    return NextResponse.json(
      { error: "Failed to fetch lead sources" },
      { status: 500 }
    );
  }
}