// /api/attendance/status/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const username = cookies().get("username")?.value;
  if (!username) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = CURDATE()",
    [username]
  );

  if (!rows.length) {
    return NextResponse.json({ status: "not_checked_in", breaks: {} });
  }

  const row = rows[0];
  if (row.checkout_time) {
    return NextResponse.json({ status: "checked_out", breaks: row });
  }

  return NextResponse.json({ status: "checked_in", breaks: row });
}
