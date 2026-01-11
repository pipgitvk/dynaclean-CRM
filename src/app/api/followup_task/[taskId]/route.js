import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
  // 1. Await params (Required in Next.js 15+)
  const resolvedParams = await params;
  const taskId = resolvedParams.taskId;

  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const data = await req.formData();
    const notes = data.get("notes")?.toString();
    const followed = data.get("followdate")?.toString();
    const status = data.get("status")?.toString();
    const completion = data.get("task_completion_date")?.toString() || null;

    if (!notes || !followed || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await conn.beginTransaction();

    // Insert follow-up record
    await conn.execute(
      `INSERT INTO task_followup (
        taskname,
        status,
        task_deadline,
        followed_date,
        task_completion_date,
        notes,
        task_id,
        createdby,
        taskassignto
      )
      SELECT 
        taskname, 
        ?, 
        next_followup_date, 
        ?, 
        ?, 
        ?, 
        ?, 
        createdby, 
        taskassignto 
      FROM task 
      WHERE task_id = ?`,
      [status, followed, completion, notes, taskId, taskId]
    );

    // Update Task table based on status
    if (status === "Working") {
      await conn.execute(
        `UPDATE task SET status = ? WHERE task_id = ?`,
        [status, taskId]
      );
    } else if (status === "Completed") {
      await conn.execute(
        `UPDATE task SET status = ?, task_completion_date = ? WHERE task_id = ?`,
        [status, completion, taskId]
      );
    }

    await conn.commit();

    // Return a JSON response instead of a redirect for AJAX fetch calls
    return NextResponse.json({ success: true, message: "Follow-up saved" });

  } catch (e) {
    console.error("Follow-up Error:", e);
    if (conn) await conn.rollback();
    return NextResponse.json({ error: "Error saving follow-up" }, { status: 500 });
  } finally {
    // 2. Crucial: Release the connection back to the pool
    if (conn) conn.release();
    console.log("Releasing connection back to pool");
  }
}