-- Add supply column to client_expenses
ALTER TABLE client_expenses ADD COLUMN supply VARCHAR(50) NULL AFTER main_head;
