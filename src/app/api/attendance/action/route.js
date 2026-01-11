// app/api/attendance/action.js
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import dayjs from "dayjs";

export async function POST(req) {
  const body = await req.json();
  const { username, action } = body;

  const conn = await getDbConnection();
  const today = dayjs().format("YYYY-MM-DD");
  const now = dayjs().format("YYYY-MM-DD HH:mm:ss");

  let [rows] = await conn.execute("SELECT * FROM attendance_logs WHERE username = ? AND date = ?", [username, today]);

  // Create new log if none
  if (rows.length === 0 && action === "checkin") {
    await conn.execute(
      "INSERT INTO attendance_logs (username, date, checkin_time) VALUES (?, ?, ?)",
      [username, today, now]
    );
    return NextResponse.json({ success: true, nextAction: "break_morning" });
  }

  const record = rows[0];
  const updateFields = {
    break_morning: "break_morning_start",
    break_lunch: "break_lunch_start",
    break_evening: "break_evening_start",
    checkout: "checkout_time",
  };

  const updateField = updateFields[action];
  if (!updateField) {
    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  }

  // Prevent re-clicking
  if (record[updateField]) {
    return NextResponse.json({ success: false, error: "Already marked" }, { status: 400 });
  }

  // Update action
  await conn.execute(
    `UPDATE attendance_logs SET ${updateField} = ? WHERE id = ?`,
    [now, record.id]
  );

  return NextResponse.json({ success: true });
}
