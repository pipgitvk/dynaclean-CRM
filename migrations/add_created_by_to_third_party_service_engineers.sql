-- Migration: Add created_by column to third_party_service_engineers table
-- Description: Track which user (ADMIN/SERVICE SUPPORT) created each third-party engineer record
-- Date: 2026-10-01

ALTER TABLE third_party_service_engineers 
ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NULL COMMENT 'Username or email of user who created this engineer record' 
AFTER status;

-- Create index on created_by for faster filtering
ALTER TABLE third_party_service_engineers 
ADD INDEX IF NOT EXISTS idx_created_by (created_by);
