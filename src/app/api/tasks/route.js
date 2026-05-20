import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const connection = await getDbConnection();

    const [rows] = await connection.execute(
      `SELECT task_id, taskname, createdby, taskassignto, followed_date, next_followup_date, notes, status
      FROM task
      WHERE taskassignto = ? AND status != 'Completed'
      ORDER BY next_followup_date ASC`,
      [username]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}
