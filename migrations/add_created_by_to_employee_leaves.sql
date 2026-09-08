-- Add created_by column to track who created the leave (for admin-created leaves)
ALTER TABLE employee_leaves ADD COLUMN created_by varchar(255) DEFAULT NULL COMMENT 'Username of superadmin/HR who created this leave record' AFTER username;

-- Add index for faster lookups
CREATE INDEX idx_created_by ON employee_leaves(created_by);
