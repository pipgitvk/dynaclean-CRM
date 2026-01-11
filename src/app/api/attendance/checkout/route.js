// /api/attendance/checkout/route.js
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

  if (!rows.length) {
    return NextResponse.json({ error: "You haven't checked in yet." }, { status: 400 });
  }

  const row = rows[0];
  if (row.checkout_time) {
    return NextResponse.json({ error: "You already checked out." }, { status: 400 });
  }

  await conn.execute(
    "UPDATE attendance_logs SET checkout_time = NOW() WHERE id = ?",
    [row.id]
  );

  return NextResponse.json({ success: true });
}
