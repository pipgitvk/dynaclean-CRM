-- Migration: Add professional_email field to employee_profiles
-- Description: Adds a new professional_email column to store work-related email address
-- Run once on MySQL: adds professional email field for employee profile

ALTER TABLE employee_profiles
  ADD COLUMN professional_email VARCHAR(255) NULL
  COMMENT 'Professional/work email address of the employee';
