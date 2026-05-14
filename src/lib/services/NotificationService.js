import { getDbConnection } from "@/lib/db";

class NotificationService {
  async sendTaskNotification(userId, task, recurringTask) {
    try {
      const conn = await getDbConnection();
      
      await this.ensureNotificationTable(conn);
      
      const message = `New recurring task assigned: "${recurringTask.task_title}" due on ${new Date(task.due_date).toLocaleDateString()}`;
      
      await conn.execute(
        `INSERT INTO notifications (user_id, message, type, related_id, created_at)
         VALUES (?, ?, 'task', ?, NOW())`,
        [userId, message, task.task_id]
      );
      
      console.log(`✅ Notification sent to user ${userId} for task ${task.task_id}`);
      
    } catch (error) {
      console.error("Error sending notification:", error);
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
