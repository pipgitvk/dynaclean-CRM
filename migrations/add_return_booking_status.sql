-- return_status ENUM: 'return_booking' (default) and 'delivered_in_warehouse'
ALTER TABLE return_products 
MODIFY COLUMN return_status ENUM('return_booking', 'delivered_in_warehouse') DEFAULT 'return_booking';
