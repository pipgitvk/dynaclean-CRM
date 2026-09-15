-- Backfill invoices.created_by for rows that are still NULL / blank.
-- Assigns username `rinku` as the invoice creator.

UPDATE invoices
SET created_by = 'rinku'
WHERE created_by IS NULL
   OR TRIM(created_by) = '';
