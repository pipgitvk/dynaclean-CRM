-- Per-user custom task categories for /admin-dashboard/new-task and /user-dashboard/new-task
CREATE TABLE IF NOT EXISTS task_custom_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  category_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_category (username, category_name),
  INDEX idx_task_custom_categories_username (username)
);
