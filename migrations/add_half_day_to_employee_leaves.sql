-- Add half-day leave support to employee_leaves table
ALTER TABLE `employee_leaves`
  ADD COLUMN `is_half_day` tinyint(1) NOT NULL DEFAULT 0 COMMENT '1 = half-day leave' AFTER `total_days`,
  ADD COLUMN `half_day_type` enum('1st_half','2nd_half') DEFAULT NULL COMMENT 'Which half of the day' AFTER `is_half_day`;
