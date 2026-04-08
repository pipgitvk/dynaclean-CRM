-- Run once on MySQL: monthly sales target per employee designation (for HR dashboard chart + Superadmin UI).
CREATE TABLE IF NOT EXISTS hr_designation_monthly_targets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  designation VARCHAR(255) NOT NULL,
  hr_username VARCHAR(128) NOT NULL DEFAULT '',
  target_amount DECIMAL(15,2) NOT NULL,
  month TINYINT UNSIGNED NOT NULL,
  year SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hr_desig_month_year_user (designation, month, year, hr_username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
