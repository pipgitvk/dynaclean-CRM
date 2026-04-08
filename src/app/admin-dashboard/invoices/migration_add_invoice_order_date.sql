-- Run once on the database that backs `invoices`.
-- Adds a manually-editable "Order Date" separate from invoice creation date.
ALTER TABLE invoices
  ADD COLUMN order_date DATE NULL DEFAULT NULL AFTER invoice_date;

