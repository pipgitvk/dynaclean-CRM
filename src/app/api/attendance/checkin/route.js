// /api/attendance/checkin/route.js
import { getDbConnection } from "@/lib/db";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  const username = cookies().get("username")?.value;
  if (!username) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const conn = await getDbConnection();

  const today = getISTDateString();
  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
    [username, today]
  );

  if (rows.length) {
    return NextResponse.json({ error: "Already checked in" }, { status: 400 });
  }

  await conn.execute(
    "INSERT INTO attendance_logs (username, date, checkin_time) VALUES (?, ?, ?)",
    [username, today, getISTDateTimeString()]
  );

  return NextResponse.json({ success: true });
}
