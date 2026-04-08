-- Run once on the database that backs `invoices` (create/edit + print view).
ALTER TABLE invoices
  ADD COLUMN buyers_order_no VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN eway_bill_no VARCHAR(128) NULL DEFAULT NULL,
  ADD COLUMN delivery_challan_no VARCHAR(128) NULL DEFAULT NULL;
