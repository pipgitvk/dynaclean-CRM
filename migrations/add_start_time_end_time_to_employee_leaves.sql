-- Migration: Add start_time and end_time columns to employee_leaves table
-- Purpose: Store time range for time-specific leave applications

ALTER TABLE employee_leaves 
ADD COLUMN start_time TIME DEFAULT NULL COMMENT 'Leave start time of day (HH:MM)' AFTER to_date,
ADD COLUMN end_time TIME DEFAULT NULL COMMENT 'Leave end time of day (HH:MM)' AFTER start_time;
