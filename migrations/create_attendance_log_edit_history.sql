CREATE TABLE IF NOT EXISTS attendance_log_edit_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  log_date DATE NOT NULL,
  edited_by VARCHAR(255) NOT NULL,
  edit_source VARCHAR(64) NOT NULL,
  changes_json TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aleh_user_date (username, log_date),
  INDEX idx_aleh_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
