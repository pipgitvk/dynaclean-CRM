-- Add mode_of_payment column to dd_records table
ALTER TABLE dd_records ADD COLUMN mode_of_payment VARCHAR(50) DEFAULT 'DD' AFTER assigned_by;
