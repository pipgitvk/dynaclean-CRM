import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import RecurrenceService from "@/lib/services/RecurrenceService";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access only" }, { status: 403 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(`
      SELECT rt.*, 
        e1.username as assigned_user_name,
        e2.username as created_by_name
      FROM recurring_tasks rt
      LEFT JOIN emplist e1 ON rt.assigned_user_id = e1.empId
      LEFT JOIN emplist e2 ON rt.created_by = e2.empId
      ORDER BY rt.created_at DESC
    `);

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error fetching recurring tasks:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access only" }, { status: 403 });
    }

    const data = await req.json();

    const validation = RecurrenceService.validateRecurrenceConfig(data);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(", "), success: false },
        { status: 400 }
      );
    }

    const {
      task_title,
      description,
      assigned_user_id,
      recurrence_type,
      repeat_interval = 1,
      weekly_days,
      monthly_date,
      yearly_month,
      yearly_date,
      start_date,
      end_date,
      due_date,
    } = data;

    const nextRunAt = RecurrenceService.calculateNextDate({
      recurrence_type,
      repeat_interval,
      weekly_days,
      monthly_date,
      yearly_month,
      yearly_date,
      due_date,
      next_run_at: start_date,
      end_date,
    });

    const conn = await getDbConnection();
    const [result] = await conn.execute(
      `INSERT INTO recurring_tasks (
        task_title, description, assigned_user_id, recurrence_type,
        repeat_interval, weekly_days, monthly_date, yearly_month, yearly_date,
        start_date, end_date, due_date, next_run_at, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task_title,
        description,
        assigned_user_id,
        recurrence_type,
        repeat_interval,
        weekly_days ? JSON.stringify(weekly_days) : null,
        monthly_date,
        yearly_month,
        yearly_date,
        start_date,
        end_date,
        due_date,
        nextRunAt,
        payload.empId || payload.id || null,
      ]
    );

    const initialTask = await RecurrenceService.generateNextTask(
      { ...data, id: result.insertId, next_run_at: nextRunAt },
      conn
    );

    return NextResponse.json({
      success: true,
      data: {
        id: result.insertId,
        next_run_at: nextRunAt,
        initial_task_id: initialTask?.task_id,
      },
    });
  } catch (error) {
    console.error("Error creating recurring task:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
