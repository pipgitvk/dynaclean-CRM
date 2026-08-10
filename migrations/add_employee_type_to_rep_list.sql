-- Add employeeType column to rep_list table
-- This migration adds the employeeType field to store Company Person or Third Party classification

ALTER TABLE rep_list 
ADD COLUMN employeeType VARCHAR(50) DEFAULT 'Company Person' AFTER userRole;

-- Update existing records to have default value
UPDATE rep_list 
SET employeeType = 'Company Person' 
WHERE employeeType IS NULL;

-- Add index for better performance
ALTER TABLE rep_list 
ADD INDEX idx_employee_type (employeeType);