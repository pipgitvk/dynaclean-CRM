import dayjs from "dayjs";
import { getDbConnection } from "@/lib/db";

class NotificationService {
  /** Header bell — only for cron / automatically created recurring tasks */
  async sendAutomaticTaskNotification(recurringTask, task) {
    const recipientIds = new Set();
    const assigneeId = Number(recurringTask.assigned_user_id);
    const creatorId = Number(recurringTask.created_by);
    if (assigneeId > 0) recipientIds.add(assigneeId);
    if (creatorId > 0) recipientIds.add(creatorId);

    if (recipientIds.size === 0) {
      console.warn("⚠️ Skipping notification: no valid assignee or creator empId");
      return;
    }

    try {
      const conn = await getDbConnection();
      await this.ensureNotificationTable(conn);

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
        console.log(`✅ Notification sent to user ${empId} for automatic task ${task.task_id}`);
      }
    } catch (error) {
      console.error("Error sending automatic task notification:", error);
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
      console.error("Error creating notifications table:", error);
    }
  }
  
  async getUnreadNotifications(userId) {
    try {
      const conn = await getDbConnection();
      await this.ensureNotificationTable(conn);
      const [notifications] = await conn.execute(
        `SELECT * FROM notifications 
         WHERE user_id = ? AND is_read = false 
         ORDER BY created_at DESC 
         LIMIT 50`,
        [userId]
      );
      return notifications;
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return [];
    }
  }
  
  async markAsRead(notificationId, userId) {
    try {
      const conn = await getDbConnection();
      await this.ensureNotificationTable(conn);
      await conn.execute(
        `UPDATE notifications 
         SET is_read = true 
         WHERE id = ? AND user_id = ?`,
        [notificationId, userId]
      );
      return { success: true };
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return { success: false };
    }
  }
}

export default new NotificationService();
