-- Add linked_statement_ids column to product_stock_request table
ALTER TABLE product_stock_request 
ADD COLUMN linked_statement_ids TEXT DEFAULT NULL 
COMMENT 'JSON array of linked statement IDs from statements table';

-- Add index for better performance
ALTER TABLE product_stock_request 
ADD INDEX idx_linked_statement_ids (linked_statement_ids(100));