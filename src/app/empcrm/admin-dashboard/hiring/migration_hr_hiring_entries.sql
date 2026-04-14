-- Run once on MySQL. HR logs hires; counts feed "completed" on the target chart for matching designation + month.

CREATE TABLE IF NOT EXISTS hr_hiring_entries (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `created_by` VARCHAR(128) NOT NULL,
  candidate_name VARCHAR(255) NOT NULL,
  designation VARCHAR(255) NOT NULL,
  hire_date DATE NOT NULL,
  note VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_hiring_user_ym (`created_by`, hire_date),
  KEY idx_hiring_desig_ym (designation(64), hire_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
