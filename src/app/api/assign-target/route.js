import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const { username, target, target_start_date, target_end_date } = await request.json();

    if (!username || !target || !target_start_date || !target_end_date) {
      return NextResponse.json(
        { message: "Username, target, start date, and end date are required." },
        { status: 400 }
      );
    }

    const payload = await getSessionPayload(request);
    const created_by = payload?.username || "system";

    const connection = await getDbConnection();

    const sql = `
      INSERT INTO target (username, target, target_start_date, target_end_date, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    const values = [username, target, target_start_date, target_end_date, created_by];

    await connection.execute(sql, values);

    return NextResponse.json(
      { message: "Target assigned successfully!" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to submit target:", error);
    return NextResponse.json(
      { message: "Failed to submit target.", error: error.message },
      { status: 500 }
    );
  }
}
