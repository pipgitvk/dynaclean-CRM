-- Add remark fields for cancelled/postponed pre-bookings
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS remark_type ENUM('cancelled', 'postponed') DEFAULT NULL COMMENT 'Order cancelled or postponed';
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS remark_reason TEXT DEFAULT NULL COMMENT 'Reason note for cancellation or postponement';
ALTER TABLE pre_booking ADD COLUMN IF NOT EXISTS postponed_date DATE DEFAULT NULL COMMENT 'New expected date when order is postponed';

-- Extend status enum to include cancelled and postponed
ALTER TABLE pre_booking MODIFY COLUMN status ENUM('pending', 'partial', 'received', 'cancelled', 'postponed') DEFAULT 'pending' COMMENT 'Pre-booking status';
