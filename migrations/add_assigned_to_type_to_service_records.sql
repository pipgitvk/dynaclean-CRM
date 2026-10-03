-- Add support for third-party engineer assignments to service_records table
-- Adds fields to track whether assignment is to internal employee or third-party engineer

ALTER TABLE `service_records` 
ADD COLUMN `assigned_to_type` VARCHAR(50) DEFAULT 'internal' COMMENT 'internal, third_party' AFTER `assigned_to`,
ADD COLUMN `assigned_to_id` INT DEFAULT NULL COMMENT 'engineer_id for third-party engineers' AFTER `assigned_to_type`,
ADD INDEX `idx_assigned_to_type` (`assigned_to_type`),
ADD INDEX `idx_assigned_to_id` (`assigned_to_id`);
