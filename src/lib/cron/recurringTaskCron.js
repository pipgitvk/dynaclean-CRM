import cron from "node-cron";
import { getDbConnection } from "@/lib/db";
import RecurrenceService from "@/lib/services/RecurrenceService";
import NotificationService from "@/lib/services/NotificationService";

export function startRecurringTaskCron() {
  cron.schedule("0 0 * * *", async () => {
    console.log("🔄 Running recurring task generation cron job...");
    await generateRecurringTasks();
  });

  console.log("✅ Recurring task cron job scheduled (runs daily at midnight)");
}

async function generateRecurringTasks() {
  let conn;
  try {
    conn = await getDbConnection();

    const [recurringTasks] = await conn.execute(`
      SELECT * FROM recurring_tasks 
      WHERE status = 'active' 
        AND is_active = true 
        AND next_run_at <= NOW()
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY next_run_at ASC
    `);

    console.log(`📋 Found ${recurringTasks.length} recurring tasks due for generation`);

    let generatedCount = 0;
    let skippedCount = 0;

    for (const task of recurringTasks) {
      try {
        if (!RecurrenceService.isTaskDue(task)) {
          skippedCount++;
          continue;
        }

        const [existingTasks] = await conn.execute(
          `SELECT id FROM task 
           WHERE parent_recurring_task_id = ? 
             AND DATE(next_followup_date) = DATE(?)`,
          [task.id, task.next_run_at]
        );

        if (existingTasks.length > 0) {
          console.log(`⏭️ Skipping duplicate task for recurring task ID ${task.id}`);
          skippedCount++;
          continue;
        }

        const result = await RecurrenceService.generateNextTask(task, conn);

        if (result) {
          generatedCount++;
          console.log(`✅ Generated task ${result.task_id} for recurring task ID ${task.id}`);
          await NotificationService.sendTaskNotification(task.assigned_user_id, result, task);
        } else {
          console.log(`🚫 Recurring task ID ${task.id} has reached end date, marked as inactive`);
        }
      } catch (error) {
        console.error(`❌ Error generating task for recurring task ID ${task.id}:`, error);
      }
    }

    console.log(
      `📊 Cron job completed: ${generatedCount} tasks generated, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error("❌ Error in recurring task cron job:", error);
  }
}

export async function manualGenerateRecurringTasks() {
  console.log("🔄 Manually triggering recurring task generation...");
  await generateRecurringTasks();
}

if (process.env.NODE_ENV === "production") {
  startRecurringTaskCron();
}
