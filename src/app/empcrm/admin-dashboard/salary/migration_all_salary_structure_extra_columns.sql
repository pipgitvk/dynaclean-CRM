-- Run once on MySQL (fixes "Unknown column 'pf'" when saving salary structure).
-- Safe to re-run only if you remove columns first; otherwise use npm run migrate:salary-structure

ALTER TABLE employee_salary_structure
  ADD COLUMN pf DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Employee PF (monthly)',
  ADD COLUMN esi DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Employee ESI (monthly)',
  ADD COLUMN health_insurance DECIMAL(12, 2) NULL DEFAULT 0 COMMENT 'Health insurance (monthly)';
