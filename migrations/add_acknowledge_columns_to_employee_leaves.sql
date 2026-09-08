-- Add acknowledgment tracking columns to employee_leaves
-- Acknowledgment can be done by Super Admin or Reporting Manager after approve/reject
ALTER TABLE `employee_leaves`
  ADD COLUMN `acknowledged_at` timestamp NULL DEFAULT NULL COMMENT 'Timestamp when HR/Admin/Manager acknowledged this leave',
  ADD COLUMN `acknowledged_by` varchar(255) DEFAULT NULL COMMENT 'Username of the person who acknowledged (SuperAdmin or Reporting Manager)';
