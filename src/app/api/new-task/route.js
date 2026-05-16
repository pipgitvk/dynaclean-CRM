// import { writeFile } from "fs/promises";
// import path from "path";
// import { NextResponse } from "next/server";
// import { jwtVerify } from "jose";
// import { getDbConnection } from "@/lib/db";

// const JWT_SECRET = process.env.JWT_SECRET;

// export async function POST(req) {
//   try {
//     // ✅ Get token from cookies
//     const token = req.cookies.get("token")?.value;
//     if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

//     const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
//     const createdby = payload.username;

//     const formData = await req.formData();

//     // ✅ Extract form fields
//     const taskname = formData.get("taskname");
//     const taskassignto = formData.get("taskassignto");
//     const next_followup_date = formData.get("next_followup_date");
//     const todaydate = formData.get("todaydate");
//     const task_prior = formData.get("task_prior");
//     const task_catg = formData.get("task_catg");
//     const notes = formData.get("notes");

//     // ✅ Handle file uploads
//     const uploadDir = path.join(process.cwd(), "public", "uploads");
//     const handleUpload = async (file, prefix) => {
//       if (!file || typeof file === "string") return "";
//       const bytes = await file.arrayBuffer();
//       const buffer = Buffer.from(bytes);
//       const ext = file.name.split(".").pop();
//       const fileName = `${prefix}_${Date.now()}.${ext}`;
//       const filePath = path.join(uploadDir, fileName);
//       await writeFile(filePath, buffer);
//       return fileName;
//     };

//     const card_front = await handleUpload(formData.get("card_front"), "img");
//     const task_video = await handleUpload(formData.get("task_video"), "video");

//     // ✅ Insert into DB
//     const conn = await getDbConnection();

//     const [[{ max_id }]] = await conn.execute("SELECT MAX(task_id) AS max_id FROM task");
//     const task_id = (max_id || 999) + 1;

//     await conn.execute(
//       `INSERT INTO task (task_id, taskname, createdby, taskassignto, status, next_followup_date, followed_date, notes, visiting_card, task_video, task_prior, task_catg)
//        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//       [
//         task_id,
//         taskname,
//         createdby,
//         taskassignto,
//         "Pending",
//         next_followup_date,
//         todaydate,
//         notes,
//         card_front,
//         task_video,
//         task_prior,
//         task_catg,
//       ]
//     );

//     await conn.execute(
//       `INSERT INTO task_followup (task_id, createdby, taskassignto) VALUES (?, ?, ?)`,
//       [task_id, createdby, taskassignto]
//     );

//         // await conn.end();

//     // ✅ Success redirect
//     return NextResponse.redirect(new URL("/user-dashboard?success=task_created", req.url));
//   } catch (err) {
//     console.error("❌ Task creation failed:", err);
//     return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
//   }
// }

import { writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import RecurrenceService from "@/lib/services/RecurrenceService";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

// Import and start the recurring task cron job
let cronStarted = false;
if (!cronStarted) {
  cronStarted = true;
  import("@/lib/cron/recurringTaskCron").then((mod) => {
    mod.startRecurringTaskCron();
  });
}

export async function POST(req) {
  try {
    // ✅ Get token from cookies
    const payload = await getSessionPayload();
    if (!payload)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const createdby = payload.username;

    const formData = await req.formData();

    // ✅ Extract form fields
    const taskname = formData.get("taskname");
    const taskassignto = formData.get("taskassignto");
    const next_followup_date = formData.get("next_followup_date");
    const todaydate = formData.get("todaydate");
    const task_prior = formData.get("task_prior");
    const task_catg = formData.get("task_catg");
    const notes = formData.get("notes");

    // Extract recurring task fields
    const is_recurring = formData.get("is_recurring") === "true" || formData.get("is_recurring") === true;
    const recurrence_type = formData.get("recurrence_type") || "daily";
    const repeat_interval = parseInt(formData.get("repeat_interval")) || 1;
    const weekly_days_raw = formData.get("weekly_days");
    let weekly_days = [];
    if (weekly_days_raw) {
      try {
        weekly_days = JSON.parse(weekly_days_raw);
      } catch (e) {
        weekly_days = [];
      }
    }
    const monthly_date = parseInt(formData.get("monthly_date")) || 1;
    const yearly_month = parseInt(formData.get("yearly_month")) || 1;
    const yearly_date = parseInt(formData.get("yearly_date")) || 1;
    const recurrence_start_date = formData.get("recurrence_start_date");
    const recurrence_end_date = formData.get("recurrence_end_date");

    // ✅ Insert guard: prevent duplicate (same user, same task name + description)
    const conn = await getDbConnection();

    const creatorEmpId = await resolveGemCrmEmployeeId(conn, {
      username: createdby,
      empId: payload.empId,
    });
    const assignedEmpId =
      (await resolveGemCrmEmployeeId(conn, { username: taskassignto })) ?? 0;

    // Normalize params to avoid collation issues (compare pre-normalized params to normalized columns)
    const norm = (s) => (s ?? "").toString().trim().toLowerCase();
    const taskname_n = norm(taskname);
    const notes_n = norm(notes);

    // Skip duplicate check for recurring tasks since they're supposed to create similar tasks
    if (!is_recurring) {
      const [[dup]] = await conn.execute(
        `SELECT task_id
           FROM task
          WHERE createdby=?
            AND LOWER(TRIM(COALESCE(taskname, ''))) = ?
            AND LOWER(TRIM(COALESCE(notes, ''))) = ?
          LIMIT 1`,
        [createdby, taskname_n, notes_n]
      );
      if (dup && dup.task_id) {
        return NextResponse.json(
          { error: "A task with the same name and description already exists." },
          { status: 409 }
        );
      }
    }

    // ✅ Handle file uploads
    const handleUpload = async (file, fileType) => {
      if (!file || typeof file === "string") return "";
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const ext = (file.name.split(".").pop() || "").toLowerCase();

      let kind = fileType;
      // Auto-detect when not explicitly provided (attachments)
      if (!fileType) {
        const mime = file.type || "";
        if (mime.startsWith("image/")) {
          kind = "image";
        } else if (mime.startsWith("video/")) {
          kind = "video";
        } else {
          kind = "doc"; // pdf/doc/docx etc.
        }
      }

      const fileName = `${kind}_${Date.now()}.${ext || "bin"}`;

      let uploadDir;
      if (kind === "image") {
        uploadDir = path.join(process.cwd(), "public", "task", "images");
      } else if (kind === "video") {
        uploadDir = path.join(process.cwd(), "public", "task", "videos");
      } else {
        uploadDir = path.join(process.cwd(), "public", "task", "docs");
      }

      // Ensure the directory exists
      await require("fs/promises").mkdir(uploadDir, { recursive: true });

      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      // Return the public path
      if (kind === "doc") return `/task/docs/${fileName}`;
      return `/task/${kind}s/${fileName}`;
    };

    // Gather multiple attachments
    const attachFiles = formData.getAll("attachments") || [];
    const savedAttachments = [];

    // Backward compatibility: also support single legacy field 'card_front'
    const legacyCard = formData.get("card_front");
    if (legacyCard && typeof legacyCard !== "string")
      attachFiles.push(legacyCard);

    for (const f of attachFiles) {
      const pathSaved = await handleUpload(f, null);
      if (pathSaved) savedAttachments.push(pathSaved);
    }

    const visiting_card = savedAttachments.join(",");
    const task_video = await handleUpload(formData.get("task_video"), "video");

    let parent_recurring_task_id = null;
    let firstRunAt = null;
    let firstTaskDue = null;

    if (is_recurring) {
      firstTaskDue = RecurrenceService.nowMysql().format("YYYY-MM-DD HH:mm:ss");
      const scheduleAt = recurrence_start_date || next_followup_date;
      firstRunAt = RecurrenceService.toMysqlDatetime(scheduleAt);
      const seriesStart = RecurrenceService.toMysqlDatetime(
        recurrence_start_date || next_followup_date
      );
      const dueDatetime = RecurrenceService.toMysqlDatetime(
        next_followup_date || recurrence_start_date
      );

      const [recurringResult] = await conn.execute(
        `INSERT INTO recurring_tasks (
          task_title, description, assigned_user_id, recurrence_type,
          repeat_interval, weekly_days, monthly_date, yearly_month, yearly_date,
          start_date, end_date, due_date, next_run_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          taskname,
          notes,
          assignedEmpId,
          recurrence_type,
          repeat_interval,
          weekly_days.length > 0 ? JSON.stringify(weekly_days) : null,
          monthly_date,
          yearly_month,
          yearly_date,
          seriesStart,
          recurrence_end_date
            ? RecurrenceService.toMysqlDatetime(recurrence_end_date)
            : null,
          dueDatetime,
          firstRunAt,
          creatorEmpId,
        ]
      );
      parent_recurring_task_id = recurringResult.insertId;
    }

    // ✅ Insert into DB
    const [[{ max_id }]] = await conn.execute(
      "SELECT MAX(task_id) AS max_id FROM task"
    );
    const task_id = (max_id || 999) + 1;

    if (is_recurring) {
      await conn.execute(
        `INSERT INTO task (
          task_id, taskname, createdby, taskassignto, status, next_followup_date,
          followed_date, notes, visiting_card, task_video, task_prior, task_catg,
          parent_recurring_task_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task_id,
          taskname,
          createdby,
          taskassignto,
          "Pending",
          firstTaskDue,
          todaydate,
          notes,
          visiting_card,
          task_video,
          task_prior,
          task_catg,
          parent_recurring_task_id,
        ]
      );
    } else {
      const taskInsertFields = ['task_id', 'taskname', 'createdby', 'taskassignto', 'status', 'next_followup_date', 'followed_date', 'notes', 'visiting_card', 'task_video', 'task_prior', 'task_catg'];
      const taskInsertValues = [
        task_id,
        taskname,
        createdby,
        taskassignto,
        "Pending",
        next_followup_date,
        todaydate,
        notes,
        visiting_card,
        task_video,
        task_prior,
        task_catg,
      ];
      await conn.execute(
        `INSERT INTO task (${taskInsertFields.join(', ')})
          VALUES (${taskInsertValues.map(() => '?').join(', ')})`,
        taskInsertValues
      );
    }

    await conn.execute(
      `INSERT INTO task_followup (
        task_id, createdby, taskassignto, followed_date, notes, taskname, status, task_deadline
      )
      SELECT task_id, createdby, taskassignto, followed_date, notes, taskname, status, next_followup_date
      FROM task WHERE task_id = ?`,
      [task_id]
    );

    console.log(`✅ Task created: Task ID ${task_id}, Name: "${taskname}", Assigned to: ${taskassignto}`);

    // First task on submit; cron creates next at scheduled time (today) or next day
    if (is_recurring) {
      const nextRunAt = RecurrenceService.getNextRunAfterFirstTask(firstRunAt, {
        recurrence_type,
        repeat_interval,
        weekly_days,
        monthly_date,
        yearly_month,
        yearly_date,
        due_date: RecurrenceService.toMysqlDatetime(next_followup_date),
        end_date: recurrence_end_date,
      });

      if (nextRunAt) {
        await conn.execute(
          `UPDATE recurring_tasks SET next_run_at = ?, last_generated_at = NOW() WHERE id = ?`,
          [nextRunAt, parent_recurring_task_id]
        );
        console.log(
          `📅 Recurring task ${parent_recurring_task_id}: first task ${task_id} created; next cron run at ${nextRunAt}`
        );
      }
    }

    // ✅ Success JSON (let client navigate to dashboard)
    return NextResponse.json(
      {
        success: true,
        task_id,
        ...(is_recurring && {
          recurring_task_id: parent_recurring_task_id,
          message: `Task created. Next automatic task when cron reaches the scheduled time.`,
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Task creation failed:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
