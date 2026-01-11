import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  let conn = null;
  try {
    conn = await getDbConnection();

    // Query 1: Fetch users for "Assigned_to" field (All users)
    const [users] = await conn.execute(`SELECT username FROM rep_list where status = 1 ORDER BY username`);

    // Query 2: Fetch users for "Assigned_by" field (Users with role ACCOUNTANT or ADMIN)
    const [adminAccountantUsers] = await conn.execute(
      `SELECT username FROM rep_list WHERE status = 1 and userRole IN ('ACCOUNTANT', 'ADMIN') ORDER BY username`
    );

    // Returning both queries
    return NextResponse.json({
      users,             // For Assigned_to
      adminAccountantUsers,  // For Assigned_by
    });
  } catch (err) {
    console.error("❌ Error fetching users:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  } finally {
    if (conn) {
          // await conn.end();
    }
  }
}
