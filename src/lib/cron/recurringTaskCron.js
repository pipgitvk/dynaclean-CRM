import cron from "node-cron";
import { getDbConnection } from "@/lib/db";
import RecurrenceService from "@/lib/services/RecurrenceService";

const GLOBAL_KEY = "__recurringTaskCronStarted__";
const GLOBAL_CRON_JOB_KEY = "__recurringTaskCronJob__";

export async function startRecurringTaskCron() {
  if (global[GLOBAL_KEY]) {
    console.log("ℹ️ Recurring task cron job already started, skipping...");
    return;
  }
  
  // Ensure unique constraint is in place first
  await RecurrenceService.ensureUniqueTaskConstraint();
  const pool = await getDbConnection();
  const conn = await pool.getConnection();
  try {
    await RecurrenceService.ensureRecurringSchema(conn);
    await RecurrenceService.backfillAutomaticTaskAssignDates(conn);
  } finally {
    conn.release();
  }
  
  // Stop any existing cron job first (just in case)
  if (global[GLOBAL_CRON_JOB_KEY]) {
    global[GLOBAL_CRON_JOB_KEY].stop();
  }
  
  // Schedule the new cron job
  const cronJob = cron.schedule("* * * * *", async () => {
    console.log("🔄 Running recurring task generation cron job...");
    await generateRecurringTasks();
  });

  // Store globally
  global[GLOBAL_KEY] = true;
  global[GLOBAL_CRON_JOB_KEY] = cronJob;
  console.log("✅ Recurring task cron job scheduled (runs every minute)");
}

async function generateRecurringTasks() {
  let conn;
  let pool;
  try {
    pool = await getDbConnection();
    conn = await pool.getConnection();

    const [[dbNow]] = await conn.execute(`SELECT NOW() as current_db_time`);
    console.log(`⏰ Current database time (NOW()): ${dbNow.current_db_time}`);

    // First, get all recurring tasks for debugging!
    const [allRecurringTasks] = await conn.execute(`SELECT * FROM recurring_tasks`);
    console.log(`📊 All recurring tasks in DB (${allRecurringTasks.length}):`, allRecurringTasks);

    // First, get all active recurring tasks that are due (without the last_generated_at condition)
    const [recurringTasks] = await conn.execute(
      `SELECT * FROM recurring_tasks 
       WHERE status = 'active' 
        AND is_active = true 
        AND start_date <= NOW()
        AND next_run_at <= NOW()
        AND (end_date IS NULL OR end_date >= NOW())
      ORDER BY next_run_at ASC
    `);

    console.log(`📋 Found ${recurringTasks.length} recurring tasks due for generation`);
    console.log("📋 Recurring tasks found:", recurringTasks);

    let generatedCount = 0;
    let skippedCount = 0;

    for (const task of recurringTasks) {
      console.log("🔍 Checking recurring task:", {
        id: task.id,
        task_title: task.task_title,
        next_run_at: task.next_run_at,
        status: task.status,
        is_active: task.is_active
      });
      
      try {
        // First, check if we already have a task for this next_run_at (no transaction yet)
        const [existingTasks] = await conn.execute(
          `SELECT id FROM task 
           WHERE parent_recurring_task_id = ? 
             AND DATE(next_followup_date) = DATE(?)
             AND TIME(next_followup_date) = TIME(?)`,
          [task.id, task.next_run_at, task.next_run_at]
        );

        if (existingTasks.length > 0) {
          console.log(`⏭️ Skipping duplicate task for recurring task ID ${task.id} (already exists)`);
          skippedCount++;
          
          // If there are existing tasks, let's update next_run_at and last_generated_at to avoid this happening again
          const nextRunAt = RecurrenceService.calculateNextDate({
            recurrence_type: task.recurrence_type,
            repeat_interval: task.repeat_interval,
            weekly_days: task.weekly_days ? JSON.parse(task.weekly_days) : null,
            monthly_date: task.monthly_date,
            yearly_month: task.yearly_month,
            yearly_date: task.yearly_date,
            due_date: task.due_date,
            next_run_at: task.next_run_at,
            end_date: task.end_date,
          });
          
          if (nextRunAt) {
            await conn.execute(
              `UPDATE recurring_tasks 
               SET next_run_at = ?, last_generated_at = NOW()
               WHERE id = ?`,
              [nextRunAt, task.id]
            );
            console.log(`🔄 Updated next_run_at for recurring task ID ${task.id} to ${nextRunAt}`);
          }
          continue;
        }

        // Now proceed with transaction to generate the task
        await conn.beginTransaction();
        
        // Lock the recurring task row
        const [[lockedTask]] = await conn.execute(
          `SELECT * FROM recurring_tasks WHERE id = ? FOR UPDATE`,
          [task.id]
        );
        
        if (!lockedTask) {
          await conn.rollback();
          skippedCount++;
          continue;
        }
        
        const isDue = RecurrenceService.isTaskDue(lockedTask);
        console.log("🔍 isTaskDue result:", isDue);
        
        if (!isDue) {
          await conn.rollback();
          skippedCount++;
          console.log("⏭️ Skipping task (not due yet)");
          continue;
        }

        // Double check for existing tasks inside transaction too
        const [existingTasks2] = await conn.execute(
          `SELECT id FROM task 
           WHERE parent_recurring_task_id = ? 
             AND DATE(next_followup_date) = DATE(?)
             AND TIME(next_followup_date) = TIME(?)`,
          [lockedTask.id, lockedTask.next_run_at, lockedTask.next_run_at]
        );

        if (existingTasks2.length > 0) {
          await conn.rollback();
          console.log(`⏭️ Skipping duplicate task for recurring task ID ${lockedTask.id} (already exists inside transaction)`);
          skippedCount++;
          continue;
        }

        const result = await RecurrenceService.generateNextTask(lockedTask, conn);

        if (result) {
          generatedCount++;
          console.log(`✅ Generated task ${result.task_id} for recurring task ID ${lockedTask.id}`);
        } else {
          console.log(`🚫 Recurring task ID ${lockedTask.id} has reached end date, marked as inactive`);
        }
        
        await conn.commit();
      } catch (error) {
        try {
          await conn.rollback();
        } catch (rollbackError) {
          console.error("❌ Error rolling back transaction:", rollbackError);
        }
        console.error(`❌ Error generating task for recurring task ID ${task.id}:`, error);
      }
    }

    console.log(
      `📊 Cron job completed: ${generatedCount} tasks generated, ${skippedCount} skipped`
    );
  } catch (error) {
    console.error("❌ Error in recurring task cron job:", error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error("❌ Error releasing database connection:", releaseError);
      }
    }
  }
}

export async function manualGenerateRecurringTasks() {
  console.log("🔄 Manually triggering recurring task generation...");
  await generateRecurringTasks();
}
