-- Update pre_booking status enum to include 'partial'
ALTER TABLE pre_booking MODIFY COLUMN status ENUM('pending', 'partial', 'received') DEFAULT 'pending' COMMENT 'Pre-booking status: pending, partial (qty less than expected), received (qty matches/exceeds)';
