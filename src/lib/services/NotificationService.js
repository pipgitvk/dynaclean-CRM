import dayjs from "dayjs";
import { getDbConnection, withPool, dbExecute } from "@/lib/db";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

class NotificationService {
  async resolveAutomaticTaskRecipients(recurringTask, taskMeta = {}) {
    const ids = new Set();
    const add = (id) => {
      const n = Number(id);
      if (n > 0) ids.add(n);
    };

    add(recurringTask?.assigned_user_id);
    add(recurringTask?.created_by);

    if (taskMeta.assigneeUsername) {
      add(await resolveGemCrmEmployeeId({ username: taskMeta.assigneeUsername }));
    }
    if (taskMeta.creatorUsername) {
      add(await resolveGemCrmEmployeeId({ username: taskMeta.creatorUsername }));
    }

    return [...ids];
  }

  /** Header bell — only for cron / automatically created recurring tasks */
  async sendAutomaticTaskNotification(recurringTask, task, taskMeta = {}) {
    try {
      await withPool(async (conn) => {
        await this.ensureNotificationTable(conn);

        const recipientIds = await this.resolveAutomaticTaskRecipients(
          recurringTask,
          taskMeta
        );

        if (recipientIds.length === 0) {
          console.warn(
            "⚠️ Skipping automatic task notification: no valid assignee/creator empId",
            {
              recurringTaskId: recurringTask?.id,
              assigned_user_id: recurringTask?.assigned_user_id,
              created_by: recurringTask?.created_by,
            }
          );
          return;
        }

        const dueLabel = task.due_date
          ? dayjs(task.due_date).format("DD MMM YYYY, hh:mm A")
          : "soon";
        const message = `Automatic task (A): "${recurringTask.task_title}" — due ${dueLabel}`;

        for (const empId of recipientIds) {
          await conn.execute(
            `INSERT INTO notifications (user_id, message, type, related_id, created_at)
             VALUES (?, ?, 'recurring_task', ?, NOW())`,
            [empId, message, task.task_id]
          );
          console.log(
            `✅ Automatic task notification sent to user ${empId} for task ${task.task_id}`
          );
        }
      });
    } catch (error) {
      console.error("❌ Error sending automatic task notification:", error);
    }
  }

  async ensureNotificationTable(conn) {
    try {
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS notifications (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          message TEXT NOT NULL,
          type VARCHAR(50) NOT NULL DEFAULT 'general',
          related_id INT NULL,
          is_read BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_notifications_user_id (user_id),
          KEY idx_notifications_is_read (is_read)
        )
      `);
    } catch (error) {
      console.error("❌ Error creating notifications table:", error);
    }
  }

  async getUnreadNotifications(userId) {
    try {
      return await withPool(async (conn) => {
        await this.ensureNotificationTable(conn);
        const [notifications] = await conn.execute(
          `SELECT * FROM notifications
           WHERE user_id = ? AND is_read = false
           ORDER BY created_at DESC
           LIMIT 50`,
          [userId]
        );
        return notifications;
      });
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      return await withPool(async (conn) => {
        await this.ensureNotificationTable(conn);
        await conn.execute(
          `UPDATE notifications
           SET is_read = true
           WHERE id = ? AND user_id = ?`,
          [notificationId, userId]
        );
        return { success: true };
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { success: false };
    }
  }

  async sendReassignNotification(
    taskId,
    taskName,
    oldAssignee,
    newAssignee,
    creatorId,
    adminId
  ) {
    try {
      await withPool(async (conn) => {
        await this.ensureNotificationTable(conn);

        const recipientIds = new Set();
        const newAssigneeId = await resolveGemCrmEmployeeId({
          username: newAssignee,
        });
        if (adminId) recipientIds.add(Number(adminId));
        if (creatorId) recipientIds.add(Number(creatorId));
        if (newAssigneeId) recipientIds.add(Number(newAssigneeId));

        if (recipientIds.size === 0) {
          console.warn("⚠️ Skipping reassign notification: no valid recipient empIds");
          return;
        }

        const messageForAssignee = `Task "${taskName}" has been reassigned to you`;
        const messageForAdmin = `Task "${taskName}" has been reassigned to ${newAssignee}`;

        for (const empId of recipientIds) {
          const message =
            empId === Number(newAssigneeId) ? messageForAssignee : messageForAdmin;

          await conn.execute(
            `INSERT INTO notifications (user_id, message, type, related_id, created_at)
             VALUES (?, ?, 'task_reassign', ?, NOW())`,
            [empId, message, taskId]
          );
          console.log(`✅ Reassign notification sent to user ${empId} for task ${taskId}`);
        }
      });
    } catch (error) {
      console.error("Error sending reassign notification:", error);
    }
  }
}

export default new NotificationService();
