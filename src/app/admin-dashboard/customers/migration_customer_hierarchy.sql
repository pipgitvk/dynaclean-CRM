-- Add parent_customer_id to link member customers to parent (for hierarchy)
-- Run manually if needed, or it will auto-apply on first Add Member
ALTER TABLE customers ADD COLUMN parent_customer_id INT NULL;
