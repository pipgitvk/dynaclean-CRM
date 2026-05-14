import { getDbConnection } from "@/lib/db";

export async function seedRecurringTasks() {
  const conn = await getDbConnection();

  try {
    console.log("🌱 Starting recurring tasks seeder...");

    const demoUserId = 1;
    const createdBy = 1;

    const demoTasks = [
      {
        task_title: "Daily Team Standup",
        description: "Daily team standup meeting at 10:00 AM",
        assigned_user_id: demoUserId,
        recurrence_type: "daily",
        repeat_interval: 1,
        weekly_days: null,
        monthly_date: null,
        yearly_month: null,
        yearly_date: null,
        start_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_date: null,
        due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
        status: "active",
        is_active: true,
        created_by: createdBy,
      },
      {
        task_title: "Weekly Report Submission",
        description: "Submit weekly progress report",
        assigned_user_id: demoUserId,
        recurrence_type: "weekly",
        repeat_interval: 1,
        weekly_days: JSON.stringify(["monday", "friday"]),
        monthly_date: null,
        yearly_month: null,
        yearly_date: null,
        start_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_date: null,
        due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
        status: "active",
        is_active: true,
        created_by: createdBy,
      },
      {
        task_title: "Monthly Performance Review",
        description: "Monthly performance review meeting",
        assigned_user_id: demoUserId,
        recurrence_type: "monthly",
        repeat_interval: 1,
        weekly_days: null,
        monthly_date: 15,
        yearly_month: null,
        yearly_date: null,
        start_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_date: null,
        due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
        status: "active",
        is_active: true,
        created_by: createdBy,
      },
      {
        task_title: "Annual Budget Planning",
        description: "Annual budget planning and review",
        assigned_user_id: demoUserId,
        recurrence_type: "yearly",
        repeat_interval: 1,
        weekly_days: null,
        monthly_date: null,
        yearly_month: 1,
        yearly_date: 15,
        start_date: new Date().toISOString().slice(0, 19).replace("T", " "),
        end_date: null,
        due_date: new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace("T", " "),
        status: "active",
        is_active: true,
        created_by: createdBy,
      },
    ];

    for (const task of demoTasks) {
      const [result] = await conn.execute(
        `INSERT INTO recurring_tasks (
          task_title, description, assigned_user_id, recurrence_type,
          repeat_interval, weekly_days, monthly_date, yearly_month, yearly_date,
          start_date, end_date, due_date, status, is_active, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          task.task_title,
          task.description,
          task.assigned_user_id,
          task.recurrence_type,
          task.repeat_interval,
          task.weekly_days,
          task.monthly_date,
          task.yearly_month,
          task.yearly_date,
          task.start_date,
          task.end_date,
          task.due_date,
          task.status,
          task.is_active,
          task.created_by,
        ]
      );
      console.log(`✅ Seeded recurring task: ${task.task_title} (ID: ${result.insertId})`);
    }

    console.log("🎉 Recurring tasks seeder completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding recurring tasks:", error);
  }
}

if (require.main === module) {
  seedRecurringTasks().then(() => process.exit(0));
}
