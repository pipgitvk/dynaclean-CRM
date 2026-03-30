import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

const HR_ROLES = ["SUPERADMIN", "HR HEAD", "HR", "HR Executive"];

async function ensureTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS salary_auto_settings (
      id INT PRIMARY KEY AUTO_INCREMENT,
      is_enabled TINYINT(1) NOT NULL DEFAULT 0,
      day_of_month INT NOT NULL DEFAULT 1,
      generate_status VARCHAR(20) NOT NULL DEFAULT 'draft',
      working_days INT NOT NULL DEFAULT 26,
      last_run_at DATETIME NULL,
      last_run_month VARCHAR(7) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await db.query("SELECT id FROM salary_auto_settings LIMIT 1");
  if (rows.length === 0) {
    await db.query(
      "INSERT INTO salary_auto_settings (is_enabled, day_of_month, generate_status, working_days) VALUES (0, 1, 'draft', 26)"
    );
  }
}

// GET - fetch current auto-payroll settings
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload || !HR_ROLES.includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const db = await getDbConnection();
    await ensureTable(db);

    const [rows] = await db.query("SELECT * FROM salary_auto_settings LIMIT 1");
    return NextResponse.json({ success: true, settings: rows[0] });
  } catch (error) {
    console.error("auto-settings GET:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

// POST - update auto-payroll settings
export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !HR_ROLES.includes(payload.role)) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 403 });
    }

    const body = await request.json();
    const { is_enabled, day_of_month, generate_status, working_days } = body;

    const enabled = is_enabled ? 1 : 0;
    const day = Math.min(28, Math.max(1, parseInt(day_of_month) || 1));
    const status = ["draft", "approved"].includes(generate_status) ? generate_status : "draft";
    const wDays = Math.min(31, Math.max(1, parseInt(working_days) || 26));

    const db = await getDbConnection();
    await ensureTable(db);

    await db.query(
      `UPDATE salary_auto_settings SET is_enabled = ?, day_of_month = ?, generate_status = ?, working_days = ?, updated_at = CURRENT_TIMESTAMP`,
      [enabled, day, status, wDays]
    );

    const [rows] = await db.query("SELECT * FROM salary_auto_settings LIMIT 1");
    return NextResponse.json({ success: true, settings: rows[0] });
  } catch (error) {
    console.error("auto-settings POST:", error);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
