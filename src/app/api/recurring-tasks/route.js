import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import RecurrenceService from "@/lib/services/RecurrenceService";
import { getRecurringTaskActor } from "@/lib/recurringTaskAccess";

const LIST_SQL = `
  SELECT rt.*,
    COALESCE(e1.username, r1.username) as assigned_user_name,
    COALESCE(e2.username, r2.username) as created_by_name
  FROM recurring_tasks rt
  LEFT JOIN emplist e1 ON rt.assigned_user_id = e1.empId
  LEFT JOIN emplist e2 ON rt.created_by = e2.empId
  LEFT JOIN rep_list r1 ON rt.assigned_user_id = r1.empId
  LEFT JOIN rep_list r2 ON rt.created_by = r2.empId
`;

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await getRecurringTaskActor(payload);
    const conn = await getDbConnection();
    await RecurrenceService.ensureRecurringSchema(conn);

    let rows;
    if (actor.privileged) {
      const [result] = await conn.execute(
        `${LIST_SQL} ORDER BY rt.created_at DESC`
      );
      rows = result;
    } else {
      if (!actor.empId) {
        return NextResponse.json({ success: true, data: [] });
      }
      const [result] = await conn.execute(
        `${LIST_SQL}
         WHERE rt.created_by = ? OR rt.assigned_user_id = ?
         ORDER BY rt.created_at DESC`,
        [actor.empId, actor.empId]
      );
      rows = result;
    }

    const data = (rows || []).map((row) => ({
      ...row,
      can_modify:
        actor.privileged || Number(row.created_by) === Number(actor.empId),
    }));

    return NextResponse.json({ success: true, data });
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

    const actor = await getRecurringTaskActor(payload);
    if (!actor.privileged && !actor.empId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        end_date || null,
        due_date,
        nextRunAt,
        actor.empId || payload.empId || payload.id || null,
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
