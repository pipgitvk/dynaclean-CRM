-- Migration: Backfill product_number from products_list to invoice_items
-- Purpose: Populate existing invoice items with product_number by matching item_code
-- Date: 2026-08-19

-- Update invoice_items by joining with products_list table
UPDATE invoice_items ii
INNER JOIN products_list pl ON ii.item_code = pl.item_code
SET ii.product_number = pl.product_number
WHERE ii.product_number IS NULL;

-- Alternative: If item_code doesn't match exactly, try matching by item_name
-- This handles cases where item_code might have changed but item_name is consistent
UPDATE invoice_items ii
INNER JOIN products_list pl ON LOWER(TRIM(ii.item_name)) = LOWER(TRIM(pl.item_name))
SET ii.product_number = pl.product_number
WHERE ii.product_number IS NULL
AND ii.item_code IS NOT NULL;

-- Log the result
SELECT 
  COUNT(*) as total_items,
  SUM(CASE WHEN product_number IS NOT NULL THEN 1 ELSE 0 END) as items_with_product_number,
  SUM(CASE WHEN product_number IS NULL THEN 1 ELSE 0 END) as items_without_product_number
FROM invoice_items;
