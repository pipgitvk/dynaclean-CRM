// app/api/attendance/log/route.js

import { getDbConnection } from "@/lib/db";
import { getISTDateString } from "@/lib/istDateTime";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const date = searchParams.get("date");

  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const conn = await getDbConnection();
  const queryDate = date || getISTDateString();

  const [rows] = await conn.execute(
    "SELECT * FROM attendance_logs WHERE username = ? AND date = ?",
    [username, queryDate]
  );

  return NextResponse.json({ log: rows[0] || null });
}

export async function PUT(req) {
  try {
    const body = await req.json();
    const { username, date, ...updates } = body;

    if (!username || !date) {
      return NextResponse.json({ error: "Username and date are required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Build the update query dynamically
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }

    if (fields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    values.push(username);
    values.push(date);

    await conn.execute(
      `UPDATE attendance_logs SET ${fields.join(", ")} WHERE username = ? AND date = ?`,
      values
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating attendance log:", error);
    return NextResponse.json({ error: "Failed to update attendance log" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("username");
    const date = searchParams.get("date");

    if (!username || !date) {
      return NextResponse.json({ error: "Username and date are required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    await conn.execute(
      "DELETE FROM attendance_logs WHERE username = ? AND date = ?",
      [username, date]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attendance log:", error);
    return NextResponse.json({ error: "Failed to delete attendance log" }, { status: 500 });
  }
}
