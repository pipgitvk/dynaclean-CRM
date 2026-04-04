-- Attendance regularization workflow: employee submits corrected times → reporting manager approves → attendance_logs updated.
-- Run once on the MySQL database (phpMyAdmin / mysql CLI).

CREATE TABLE IF NOT EXISTS attendance_regularization_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  log_date DATE NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  reason TEXT NULL,
  original_checkin_time DATETIME NULL,
  original_checkout_time DATETIME NULL,
  original_break_morning_start DATETIME NULL,
  original_break_morning_end DATETIME NULL,
  original_break_lunch_start DATETIME NULL,
  original_break_lunch_end DATETIME NULL,
  original_break_evening_start DATETIME NULL,
  original_break_evening_end DATETIME NULL,
  proposed_checkin_time DATETIME NULL,
  proposed_checkout_time DATETIME NULL,
  proposed_break_morning_start DATETIME NULL,
  proposed_break_morning_end DATETIME NULL,
  proposed_break_lunch_start DATETIME NULL,
  proposed_break_lunch_end DATETIME NULL,
  proposed_break_evening_start DATETIME NULL,
  proposed_break_evening_end DATETIME NULL,
  reviewed_by VARCHAR(255) NULL,
  reviewed_at DATETIME NULL,
  reviewer_comment TEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ar_user_date (username, log_date),
  KEY idx_ar_status (status)
);
