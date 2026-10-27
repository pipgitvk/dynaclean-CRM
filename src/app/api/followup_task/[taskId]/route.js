import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { getSessionPayload } from "@/lib/auth";

// Use uploads/ + /api/image/... so files are served by the Node handler (same as other media).
// public/task_followup_images often 404s behind reverse proxies or ephemeral serverless disks.
const UPLOAD_DIR = path.join(process.cwd(), "uploads", "task_followup");

async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

async function saveImage(file) {
  if (!file || typeof file === "string") return null;
  await ensureUploadDir();
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = path.extname(file.name) || ".jpg";
  const filename = `followup-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);
  await fs.writeFile(filepath, buffer);
  return `/api/image/task_followup/${filename}`;
}

export async function GET(_req, { params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const taskId = resolvedParams.taskId;
  const pool = await getDbConnection();

  try {
    const [[taskRow]] = await pool.execute(
      `SELECT task_id, taskname, taskassignto, next_followup_date, status
       FROM task WHERE task_id = ?`,
      [taskId],
    );

    if (!taskRow) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const [followups] = await pool.execute(
      `SELECT followed_date, notes, status, image_path FROM task_followup
       WHERE task_id = ?
         AND (
           followed_date IS NOT NULL
           OR (notes IS NOT NULL AND TRIM(notes) <> '')
         )
       ORDER BY followed_date DESC`,
      [taskId],
    );

    return NextResponse.json({
      success: true,
      task: taskRow,
      followups: followups || [],
    });
  } catch (e) {
    console.error("Follow-up GET Error:", e);
    return NextResponse.json({ error: "Failed to load follow-up" }, { status: 500 });
  }
}

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
    const imageFile = data.get("image");

    if (!notes || !followed || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const imagePath = await saveImage(imageFile);

    // Ensure image_path column exists (auto-migration)
    try {
      await conn.execute(
        `ALTER TABLE task_followup ADD COLUMN image_path VARCHAR(500) NULL`
      );
    } catch (e) {
      if (e.errno !== 1060) throw e; // 1060 = Duplicate column name (already exists)
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
        taskassignto,
        image_path
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
        taskassignto,
        ?
      FROM task 
      WHERE task_id = ?`,
      [status, followed, completion, notes, taskId, imagePath || null, taskId]
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