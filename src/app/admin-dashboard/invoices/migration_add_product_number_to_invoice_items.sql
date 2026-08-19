-- Migration: Add product_number column to invoice_items table
-- Purpose: Store product number from products_list table for invoice line items
-- Date: 2026-08-19

ALTER TABLE invoice_items 
ADD COLUMN product_number INT NULL 
AFTER item_code;

-- Add index for faster lookups if needed
ALTER TABLE invoice_items 
ADD INDEX idx_product_number (product_number);
