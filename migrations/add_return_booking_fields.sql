-- Add return booking fields to neworder table
ALTER TABLE neworder
ADD COLUMN IF NOT EXISTS return_booking_id INT DEFAULT 0 COMMENT 'Reference to return booking (0 or NULL = no booking)',
ADD COLUMN IF NOT EXISTS return_booking_date DATE NULL COMMENT 'Date when return booking was created',
ADD COLUMN IF NOT EXISTS return_booking_by VARCHAR(255) NULL COMMENT 'Person who created the return booking',
ADD COLUMN IF NOT EXISTS return_booking_remarks TEXT NULL COMMENT 'Remarks for return booking',
ADD COLUMN IF NOT EXISTS return_location VARCHAR(255) NULL COMMENT 'Location where product will be returned to',
ADD INDEX idx_return_booking_id (return_booking_id);
