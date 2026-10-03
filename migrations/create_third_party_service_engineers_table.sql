-- Create Third Party Service Engineers table (merged with attachments)
-- Stores third-party service engineer information with attachment support

CREATE TABLE IF NOT EXISTS `third_party_service_engineers` (
  `engineer_id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `mobile` VARCHAR(20) NOT NULL,
  `email` VARCHAR(255) UNIQUE NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `address` TEXT,
  `state` VARCHAR(100),
  `geo_location` VARCHAR(255),
  `remark` TEXT,
  `attachments` LONGTEXT COMMENT 'JSON array of attachment objects: [{"id": int, "name": string, "file_path": string, "created_at": timestamp}]',
  `status` VARCHAR(20) DEFAULT 'active' COMMENT 'active, inactive',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_email` (`email`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
