import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT DISTINCT userRole FROM rep_list WHERE userRole != 'ADMIN'`
    );
        // await conn.end();

    const userRoles = rows.map((row) => row.userRole);
    return NextResponse.json(userRoles, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch user roles:", error);
    return NextResponse.json(
      { error: "Failed to retrieve user roles." },
      { status: 500 }
    );
  }
}