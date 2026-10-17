-- =============================================================================
-- Manual migration: Order ↔ Invoice ↔ Statement payment linking
-- (order list Linked Payment, upload prefill, invoice delete/cancel clear,
--  Payment Link on new invoice, one active tax invoice per order)
--
-- Run on MySQL/MariaDB. Safe to re-run if you use IF NOT EXISTS (MySQL 8.0.29+).
-- Agar purane MySQL par "IF NOT EXISTS" error aaye, har line alag chalao;
-- "Duplicate column" aaye to us column ko skip karo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) neworder — linked payment snapshot (list + sync from invoice/statements)
-- -----------------------------------------------------------------------------
ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS amount_received DECIMAL(15,2) NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS payment_received_date DATE NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS linked_payments_json TEXT NULL DEFAULT NULL;

-- Pehle se honi chahiye (upload / payment edit); agar missing ho to:
ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS payment_id VARCHAR(500) NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS payment_date VARCHAR(500) NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS payment_amount VARCHAR(500) NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) NULL DEFAULT NULL;

ALTER TABLE neworder
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) NULL DEFAULT NULL;

-- -----------------------------------------------------------------------------
-- 2) invoices — payment link + status (create / cancel / delete order sync)
-- -----------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS linked_trans_ids TEXT NULL DEFAULT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS status ENUM('PAID', 'PARTIAL PAID', 'CANCELLED') NULL DEFAULT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS type VARCHAR(20) NULL DEFAULT 'tax';

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS buyers_order_no VARCHAR(100) NULL DEFAULT NULL;

-- Optional (agar pehle migration na chali ho):
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS customer_id VARCHAR(64) NULL DEFAULT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS cgst_rate DECIMAL(5,2) NULL DEFAULT 0;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS sgst_rate DECIMAL(5,2) NULL DEFAULT 0;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS igst_rate DECIMAL(5,2) NULL DEFAULT 0;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS created_by VARCHAR(255) NULL DEFAULT NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS employee_name VARCHAR(255) NULL DEFAULT NULL;

-- -----------------------------------------------------------------------------
-- 3) statements — link credit lines to invoice (Payment Link modal)
-- -----------------------------------------------------------------------------
ALTER TABLE statements
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100) NULL DEFAULT NULL;

ALTER TABLE statements
  ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) NULL DEFAULT NULL;

-- -----------------------------------------------------------------------------
-- 4) Optional indexes (performance; skip if index already exists)
-- -----------------------------------------------------------------------------
-- CREATE INDEX idx_neworder_invoice_number ON neworder (invoice_number);
-- CREATE INDEX idx_invoices_buyers_order_no ON invoices (buyers_order_no);
-- CREATE INDEX idx_invoices_quotation_id ON invoices (quotation_id);
-- CREATE INDEX idx_statements_invoice_number ON statements (invoice_number);

-- -----------------------------------------------------------------------------
-- 5) Verify (read-only)
-- -----------------------------------------------------------------------------
-- SHOW COLUMNS FROM neworder LIKE 'amount_received';
-- SHOW COLUMNS FROM neworder LIKE 'linked_payments_json';
-- SHOW COLUMNS FROM invoices LIKE 'linked_trans_ids';
-- SHOW COLUMNS FROM statements LIKE 'invoice_number';
