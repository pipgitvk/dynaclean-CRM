-- Add 'half-day' to leave_type ENUM in employee_leaves table
-- This fixes the issue where half-day leaves were stored with blank leave_type
ALTER TABLE `employee_leaves`
  MODIFY COLUMN `leave_type` enum('sick','paid','casual','unpaid','half-day') NOT NULL;

-- Update all existing half-day records to use 'half-day' as leave_type
UPDATE `employee_leaves`
SET `leave_type` = 'half-day'
WHERE `is_half_day` = 1 AND `leave_type` != 'half-day';
