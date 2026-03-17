-- Add parent_customer_id to link member customers to parent (for hierarchy)
-- Run manually if needed, or it will auto-apply on first Add Member
ALTER TABLE customers ADD COLUMN parent_customer_id INT NULL;

-- Add report_to, working, designation, contact_status so contacts live in customers table (no separate customer_contact)
-- Run manually if needed. Columns auto-apply on first Add Contact / Add Member.
-- If column already exists, skip that ALTER (MySQL will error on duplicate column).
ALTER TABLE customers ADD COLUMN report_to INT NULL;
ALTER TABLE customers ADD COLUMN working TINYINT(1) DEFAULT 1;
ALTER TABLE customers ADD COLUMN designation VARCHAR(100) NULL;
ALTER TABLE customers ADD COLUMN contact_status VARCHAR(50) NULL;
