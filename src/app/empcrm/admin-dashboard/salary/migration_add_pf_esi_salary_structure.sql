-- Run once on your MySQL database for employee_salary_structure.
-- Adds PF and ESI as optional monthly amounts (same unit as other structure fields).
-- If columns already exist, skip this file (MySQL will error on duplicate column).

ALTER TABLE employee_salary_structure
  ADD COLUMN pf DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Employee PF (monthly)',
  ADD COLUMN esi DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Employee ESI (monthly)';
