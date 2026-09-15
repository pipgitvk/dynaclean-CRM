import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import RecurrenceService from "@/lib/services/RecurrenceService";
import {
  getRecurringTaskActor,
  canViewRecurringTask,
  canModifyRecurringTask,
} from "@/lib/recurringTaskAccess";

async function loadTask(conn, id) {
  const [rows] = await conn.execute(
    `SELECT rt.*,
      COALESCE(e1.username, r1.username) as assigned_user_name,
      COALESCE(e2.username, r2.username) as created_by_name
    FROM recurring_tasks rt
    LEFT JOIN emplist e1 ON rt.assigned_user_id = e1.empId
    LEFT JOIN emplist e2 ON rt.created_by = e2.empId
    LEFT JOIN rep_list r1 ON rt.assigned_user_id = r1.empId
    LEFT JOIN rep_list r2 ON rt.created_by = r2.empId
    WHERE rt.id = ?`,
    [id]
  );
  return rows[0] || null;
}

export async function GET(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await getRecurringTaskActor(payload);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const conn = await getDbConnection();
    const task = await loadTask(conn, id);

    if (!task) {
      return NextResponse.json({ error: "Recurring task not found" }, { status: 404 });
    }
    if (!canViewRecurringTask(actor, task)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...task,
        can_modify: canModifyRecurringTask(actor, task),
      },
    });
  } catch (error) {
    console.error("Error fetching recurring task:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function PUT(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await getRecurringTaskActor(payload);
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const data = await req.json();

    const conn = await getDbConnection();
    const currentTask = await loadTask(conn, id);

    if (!currentTask) {
      return NextResponse.json({ error: "Recurring task not found" }, { status: 404 });
    }
    if (!canModifyRecurringTask(actor, currentTask)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (data.recurrence_type) {
      const validation = RecurrenceService.validateRecurrenceConfig(data);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.errors.join(", "), success: false },
          { status: 400 }
        );
      }
    }

    const allowedFields = [
      "task_title",
      "description",
      "assigned_user_id",
      "recurrence_type",
      "repeat_interval",
      "weekly_days",
      "monthly_date",
      "yearly_month",
      "yearly_date",
      "start_date",
      "end_date",
      "due_date",
      "status",
      "is_active",
    ];

    const updateFields = [];
    const updateValues = [];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        if (field === "weekly_days" && Array.isArray(data[field])) {
          updateFields.push(`${field} = ?`);
          updateValues.push(JSON.stringify(data[field]));
        } else if (field === "end_date" && data[field] === "") {
          updateFields.push(`${field} = ?`);
          updateValues.push(null);
        } else if (field === "is_active") {
          updateFields.push(`${field} = ?`);
          updateValues.push(data[field] ? 1 : 0);
        } else {
          updateFields.push(`${field} = ?`);
          updateValues.push(data[field]);
        }
      }
    });

    if (updateFields.length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    if (
      data.recurrence_type ||
      data.repeat_interval ||
      data.weekly_days ||
      data.monthly_date ||
      data.yearly_month ||
      data.yearly_date ||
      data.due_date ||
      data.start_date
    ) {
      let weeklyDays = data.weekly_days;
      if (!weeklyDays && currentTask.weekly_days) {
        try {
          weeklyDays =
            typeof currentTask.weekly_days === "string"
              ? JSON.parse(currentTask.weekly_days)
              : currentTask.weekly_days;
        } catch {
          weeklyDays = null;
        }
      }

      const nextRunAt = RecurrenceService.calculateNextDate({
        recurrence_type: data.recurrence_type || currentTask.recurrence_type,
        repeat_interval: data.repeat_interval || currentTask.repeat_interval,
        weekly_days: weeklyDays,
        monthly_date: data.monthly_date || currentTask.monthly_date,
        yearly_month: data.yearly_month || currentTask.yearly_month,
        yearly_date: data.yearly_date || currentTask.yearly_date,
        due_date: data.due_date || currentTask.due_date,
        next_run_at: data.start_date || currentTask.start_date,
        end_date: data.end_date || currentTask.end_date,
      });

      updateFields.push("next_run_at = ?");
      updateValues.push(nextRunAt);
    }

    updateValues.push(id);
    await conn.execute(
      `UPDATE recurring_tasks SET ${updateFields.join(", ")} WHERE id = ?`,
      updateValues
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating recurring task:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await getRecurringTaskActor(payload);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const conn = await getDbConnection();
    const task = await loadTask(conn, id);

    if (!task) {
      return NextResponse.json({ error: "Recurring task not found" }, { status: 404 });
    }
    if (!canModifyRecurringTask(actor, task)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await conn.execute("DELETE FROM recurring_tasks WHERE id = ?", [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting recurring task:", error);
    return NextResponse.json(
      { error: error.message, success: false },
      { status: 500 }
    );
  }
}
