import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function POST(req) {
  const { task_id, newAssignee } = await req.json();
  const conn = await getDbConnection();

  try {
    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await conn.query(
      `UPDATE task SET taskassignto = ? WHERE task_id = ?`,
      [newAssignee, task_id]
    );
    await conn.query(
      `UPDATE task_followup SET reassign = ?, reassigndatetime = ? WHERE task_id = ?`,
      [newAssignee, now, task_id]
    );
    return NextResponse.json({ message: "Reassigned successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  } finally {
        // await conn.end();  // Close the connection properly
  }
}
