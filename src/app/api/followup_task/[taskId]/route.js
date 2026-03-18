import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "task_followup_images");

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
  return `/task_followup_images/${filename}`;
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