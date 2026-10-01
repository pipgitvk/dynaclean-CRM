-- Add attachment fields to employee_leaves table for Sick Leave documents
-- This migration adds support for storing doctor prescriptions and test reports

ALTER TABLE `employee_leaves` 
ADD COLUMN `attachment_path` VARCHAR(500) DEFAULT NULL COMMENT 'Path to uploaded attachment (prescription/test report)',
ADD COLUMN `attachment_filename` VARCHAR(255) DEFAULT NULL COMMENT 'Original filename of the attachment',
ADD COLUMN `attachment_mime_type` VARCHAR(100) DEFAULT NULL COMMENT 'MIME type of the attachment (pdf, jpg, png, etc)',
ADD COLUMN `attachment_uploaded_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'When the attachment was uploaded';

-- Create index for faster queries
CREATE INDEX idx_attachment_path ON `employee_leaves` (`attachment_path`);
