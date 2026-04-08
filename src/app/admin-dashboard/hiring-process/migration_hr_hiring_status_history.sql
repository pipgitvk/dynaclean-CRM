-- Run once after hr_hiring_entries exists. Audit trail for hiring status (admin Hiring Process view).

CREATE TABLE IF NOT EXISTS hr_hiring_entry_status_history (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  entry_id INT UNSIGNED NOT NULL,
  status_before VARCHAR(80) NULL COMMENT 'NULL = row created with status_after',
  status_after VARCHAR(80) NOT NULL,
  actor_username VARCHAR(128) NOT NULL,
  logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_hiring_hist_entry (entry_id),
  KEY idx_hiring_hist_logged (logged_at),
  CONSTRAINT fk_hiring_hist_entry FOREIGN KEY (entry_id) REFERENCES hr_hiring_entries(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One-time snapshot for existing rows (safe to re-run: skips if history already exists for that entry)
INSERT INTO hr_hiring_entry_status_history (entry_id, status_before, status_after, actor_username, logged_at)
SELECT h.id, NULL, h.status, h.created_by_username, h.created_at
FROM hr_hiring_entries h
WHERE NOT EXISTS (
  SELECT 1 FROM hr_hiring_entry_status_history x WHERE x.entry_id = h.id
);
