-- Change present_days and working_days from INT to DECIMAL to support decimal values
ALTER TABLE monthly_salary_records 
MODIFY COLUMN working_days DECIMAL(5,2) DEFAULT NULL,
MODIFY COLUMN present_days DECIMAL(5,2) DEFAULT NULL;
