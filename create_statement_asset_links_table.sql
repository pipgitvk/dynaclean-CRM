-- Create junction table for statement-asset links
CREATE TABLE IF NOT EXISTS statement_asset_links (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  statement_id INT UNSIGNED NOT NULL,
  asset_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_statement_asset (statement_id, asset_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
