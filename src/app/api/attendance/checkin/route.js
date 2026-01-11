// /api/attendance/checkin/route.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const username = cookies().get("username")?.value;
  if (!username) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const conn = await getDbConnection();

  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = CURDATE()",
    [username]
  );

  if (rows.length) {
    return NextResponse.json({ error: "Already checked in" }, { status: 400 });
  }

  await conn.execute(
    "INSERT INTO attendance_logs (username, date, checkin_time) VALUES (?, CURDATE(), NOW())",
    [username]
  );

  return NextResponse.json({ success: true });
}
