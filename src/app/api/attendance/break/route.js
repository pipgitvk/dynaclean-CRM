// /api/attendance/break/route.js
import { getDbConnection } from "@/lib/db";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req) {
  const username = cookies().get("username")?.value;
  if (!username) return NextResponse.json({ error: "Not logged in" }, { status: 401 });

  const { type, action } = await req.json();
  const column = `${type}_${action}`; // e.g. break_morning_start

  if (!["start", "end"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const conn = await getDbConnection();

  const today = getISTDateString();
  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
    [username, today]
  );

  if (!rows.length) {
    return NextResponse.json({ error: "Check-in required first" }, { status: 400 });
  }

  const row = rows[0];
  if (row.checkout_time) {
    return NextResponse.json({ error: "You have already checked out." }, { status: 400 });
  }

  await conn.execute(
    `UPDATE attendance_logs SET ${column} = ? WHERE id = ?`,
    [getISTDateTimeString(), row.id]
  );

  return NextResponse.json({ success: true });
}
