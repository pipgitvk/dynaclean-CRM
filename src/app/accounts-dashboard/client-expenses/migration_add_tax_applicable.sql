ALTER TABLE client_expenses ADD COLUMN tax_applicable TINYINT(1) NOT NULL DEFAULT 0 AFTER group_name;
ALTER TABLE client_expenses ADD COLUMN tax_type VARCHAR(50) NULL AFTER tax_applicable;
