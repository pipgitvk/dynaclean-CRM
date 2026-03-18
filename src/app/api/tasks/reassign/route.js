import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(req) {
  const { task_id, newAssignee } = await req.json();
  const payload = await getSessionPayload();
  const currentUser = payload?.username || "Unknown";

  const conn = await getDbConnection();

  try {
    const [[taskRow]] = await conn.execute(
      `SELECT createdby FROM task WHERE task_id = ?`,
      [task_id]
    );
    if (!taskRow || taskRow.createdby !== currentUser) {
      return NextResponse.json(
        { error: "Only the task creator can reassign this task" },
        { status: 403 }
      );
    }

    const now = new Date().toISOString().slice(0, 19).replace("T", " ");
    await conn.query(
      `UPDATE task SET taskassignto = ? WHERE task_id = ?`,
      [newAssignee, task_id]
    );
    await conn.query(
      `UPDATE task_followup SET reassign = ?, reassigndatetime = ? WHERE task_id = ?`,
      [newAssignee, now, task_id]
    );
    // Log reassign in follow-up history so it appears in Follow-up History table
    const notes = `Reassigned to ${newAssignee} by ${currentUser}`;
    await conn.query(
      `INSERT INTO task_followup (
        taskname, status, task_deadline, followed_date, task_completion_date,
        notes, task_id, createdby, taskassignto, reassign, reassigndatetime
      )
      SELECT taskname, status, next_followup_date, ?, NULL, ?, task_id, ?, taskassignto, ?, ?
      FROM task WHERE task_id = ?`,
      [now, notes, currentUser, newAssignee, now, task_id]
    );
    return NextResponse.json({ message: "Reassigned successfully" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Database update failed" }, { status: 500 });
  }
}
