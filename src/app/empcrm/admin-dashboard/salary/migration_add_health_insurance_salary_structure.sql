-- Run once on employee_salary_structure. Skip if column already exists.

ALTER TABLE employee_salary_structure
  ADD COLUMN health_insurance DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Health insurance (monthly)';
