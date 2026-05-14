import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

class RecurrenceService {
  /**
   * Calculate next run date based on recurrence configuration
   */
  calculateNextDate(config) {
    const {
      recurrence_type,
      repeat_interval = 1,
      weekly_days,
      monthly_date,
      yearly_month,
      yearly_date,
      due_date,
      next_run_at,
      end_date,
    } = config;

    const baseDate = dayjs(next_run_at || due_date);
    let nextDate = null;

    switch (recurrence_type) {
      case "daily":
        nextDate = baseDate.add(repeat_interval, "day");
        break;

      case "weekly":
        nextDate = this.calculateNextWeeklyDate(baseDate, weekly_days, repeat_interval);
        break;

      case "monthly":
        nextDate = this.calculateNextMonthlyDate(baseDate, monthly_date, repeat_interval);
        break;

      case "yearly":
        nextDate = this.calculateNextYearlyDate(baseDate, yearly_month, yearly_date, repeat_interval);
        break;

      default:
        return null;
    }

    if (end_date && dayjs(nextDate).isAfter(dayjs(end_date))) {
      return null;
    }

    return nextDate ? nextDate.toISOString() : null;
  }

  calculateNextWeeklyDate(currentDate, weekly_days, repeat_interval = 1) {
    if (!weekly_days || weekly_days.length === 0) {
      return currentDate.add(7 * repeat_interval, "day");
    }

    const weekdayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const currentDay = currentDate.day();
    const targetDays = weekly_days.map((day) => weekdayMap[day.toLowerCase()]).sort();

    let nextDay = targetDays.find((day) => day > currentDay);
    
    if (nextDay === undefined) {
      nextDay = targetDays[0];
      return currentDate.add(7 * repeat_interval, "day").day(nextDay);
    }

    return currentDate.add(nextDay - currentDay, "day");
  }

  calculateNextMonthlyDate(currentDate, monthly_date, repeat_interval = 1) {
    const targetDate = monthly_date || currentDate.date();
    let nextMonth = currentDate.add(repeat_interval, "month");

    const daysInMonth = nextMonth.daysInMonth();
    const adjustedDate = Math.min(targetDate, daysInMonth);

    return nextMonth.date(adjustedDate);
  }

  calculateNextYearlyDate(currentDate, yearly_month, yearly_date, repeat_interval = 1) {
    const targetMonth = yearly_month || currentDate.month() + 1;
    const targetDate = yearly_date || currentDate.date();
    
    let nextYear = currentDate.add(repeat_interval, "year");
    nextYear = nextYear.month(targetMonth - 1);
    
    const daysInMonth = nextYear.daysInMonth();
    const adjustedDate = Math.min(targetDate, daysInMonth);
    
    return nextYear.date(adjustedDate);
  }

  isTaskDue(task) {
    const now = dayjs();
    const nextRunAt = dayjs(task.next_run_at);
    const endDate = task.end_date ? dayjs(task.end_date) : null;

    if (task.status !== "active" || !task.is_active) {
      return false;
    }

    if (endDate && now.isAfter(endDate)) {
      return false;
    }

    return now.isAfter(nextRunAt) || now.isSame(nextRunAt, "day");
  }

  async generateNextTask(recurringTask, conn) {
    const nextRunAt = this.calculateNextDate({
      recurrence_type: recurringTask.recurrence_type,
      repeat_interval: recurringTask.repeat_interval,
      weekly_days: recurringTask.weekly_days ? JSON.parse(recurringTask.weekly_days) : null,
      monthly_date: recurringTask.monthly_date,
      yearly_month: recurringTask.yearly_month,
      yearly_date: recurringTask.yearly_date,
      due_date: recurringTask.due_date,
      next_run_at: recurringTask.next_run_at,
      end_date: recurringTask.end_date,
    });

    if (!nextRunAt) {
      await conn.execute(
        `UPDATE recurring_tasks SET status = 'inactive', is_active = false WHERE id = ?`,
        [recurringTask.id]
      );
      return null;
    }

    const [result] = await conn.execute(
      `INSERT INTO task (
        taskname, notes, taskassignto, next_followup_date, 
        status, createdby, parent_recurring_task_id
      ) VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
      [
        recurringTask.task_title,
        recurringTask.description,
        recurringTask.assigned_user_id,
        nextRunAt,
        recurringTask.created_by,
        recurringTask.id,
      ]
    );

    await conn.execute(
      `UPDATE recurring_tasks 
       SET next_run_at = ?, last_generated_at = NOW()
       WHERE id = ?`,
      [nextRunAt, recurringTask.id]
    );

    return {
      task_id: result.insertId,
      parent_recurring_task_id: recurringTask.id,
      due_date: nextRunAt,
    };
  }

  validateRecurrenceConfig(data) {
    const errors = [];

    if (!data.recurrence_type || !["daily", "weekly", "monthly", "yearly"].includes(data.recurrence_type)) {
      errors.push("Valid recurrence_type is required (daily, weekly, monthly, yearly)");
    }

    if (!data.due_date) {
      errors.push("due_date is required");
    }

    if (!data.start_date) {
      errors.push("start_date is required");
    }

    if (data.due_date && data.start_date && dayjs(data.due_date).isBefore(dayjs(data.start_date))) {
      errors.push("due_date must be >= start_date");
    }

    if (data.recurrence_type === "weekly") {
      if (!data.weekly_days || !Array.isArray(data.weekly_days) || data.weekly_days.length === 0) {
        errors.push("weekly_days array is required for weekly recurrence");
      } else {
        const validDays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        const invalidDays = data.weekly_days.filter((day) => !validDays.includes(day.toLowerCase()));
        if (invalidDays.length > 0) {
          errors.push(`Invalid weekdays: ${invalidDays.join(", ")}`);
        }
      }
    }

    if (data.recurrence_type === "monthly") {
      if (!data.monthly_date || data.monthly_date < 1 || data.monthly_date > 31) {
        errors.push("monthly_date must be between 1 and 31");
      }
    }

    if (data.recurrence_type === "yearly") {
      if (!data.yearly_month || data.yearly_month < 1 || data.yearly_month > 12) {
        errors.push("yearly_month must be between 1 and 12");
      }
      if (!data.yearly_date || data.yearly_date < 1 || data.yearly_date > 31) {
        errors.push("yearly_date must be between 1 and 31");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export default new RecurrenceService();
