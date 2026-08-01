-- Add qty field to product_accessories table
ALTER TABLE product_accessories ADD COLUMN qty INT DEFAULT 1 COMMENT 'Quantity of the accessory' AFTER is_mandatory;
