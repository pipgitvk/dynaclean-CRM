-- Migration: Create terms_conditions table
-- Description: Table to store terms and conditions for different document types

CREATE TABLE IF NOT EXISTS `terms_conditions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT 'Title/header for the terms',
  `terms_text` text NOT NULL COMMENT 'Actual terms and conditions text',
  `applicable_for` json DEFAULT NULL COMMENT 'JSON object defining which document types this applies to',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_title` (`title`),
  INDEX `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Terms and conditions for various document types';