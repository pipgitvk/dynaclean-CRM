-- MySQL: Create holidays table
CREATE TABLE IF NOT EXISTS holidays (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  holiday_date DATE NOT NULL,
  description TEXT NULL,
  
  created_by VARCHAR(100) NOT NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_holiday_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional seed example
-- INSERT INTO holidays (title, holiday_date, description, created_by)
-- VALUES ('New Year\'s Day', '2025-01-01', 'Company-wide holiday', 'system');
