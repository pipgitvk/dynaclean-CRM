-- Add order_id and received_date fields to pre_booking table
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS order_id VARCHAR(255) DEFAULT NULL COMMENT 'Order ID when received';
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS received_date DATE DEFAULT NULL COMMENT 'Date when order was received';
