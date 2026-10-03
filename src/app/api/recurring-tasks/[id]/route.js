import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import RecurrenceService from "@/lib/services/RecurrenceService";

export async function GET(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access only" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT rt.*, 
        e1.username as assigned_user_name,
        e2.username as created_by_name
      FROM recurring_tasks rt
      LEFT JOIN emplist e1 ON rt.assigned_user_id = e1.empId
      LEFT JOIN emplist e2 ON rt.created_by = e2.empId
      WHERE rt.id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Recurring task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
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

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access only" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;
    const data = await req.json();

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
      data.due_date
    ) {
      const conn = await getDbConnection();
      const [currentTask] = await conn.execute(
        "SELECT * FROM recurring_tasks WHERE id = ?",
        [id]
      );

      if (currentTask.length === 0) {
        return NextResponse.json({ error: "Recurring task not found" }, { status: 404 });
      }

      const nextRunAt = RecurrenceService.calculateNextDate({
        recurrence_type: data.recurrence_type || currentTask[0].recurrence_type,
        repeat_interval: data.repeat_interval || currentTask[0].repeat_interval,
        weekly_days: data.weekly_days
          ? data.weekly_days
          : currentTask[0].weekly_days
          ? JSON.parse(currentTask[0].weekly_days)
          : null,
        monthly_date: data.monthly_date || currentTask[0].monthly_date,
        yearly_month: data.yearly_month || currentTask[0].yearly_month,
        yearly_date: data.yearly_date || currentTask[0].yearly_date,
        due_date: data.due_date || currentTask[0].due_date,
        next_run_at: data.start_date || currentTask[0].start_date,
        end_date: data.end_date || currentTask[0].end_date,
      });

      updateFields.push("next_run_at = ?");
      updateValues.push(nextRunAt);
    }

    updateValues.push(id);

    const conn = await getDbConnection();
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

    const role = String(payload.role || "").trim().toUpperCase();
    if (!["SUPERADMIN", "ADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access only" }, { status: 403 });
    }

    const resolvedParams = await params;
    const id = resolvedParams.id;

    const conn = await getDbConnection();
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
