// app/api/attendance/log/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import dayjs from "dayjs";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const conn = await getDbConnection();
  const today = dayjs().format("YYYY-MM-DD");

  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
    [username, today]
  );

  return NextResponse.json({ log: rows[0] || null });
}
