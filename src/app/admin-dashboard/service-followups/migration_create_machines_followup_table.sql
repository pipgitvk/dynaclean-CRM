-- MySQL: Create machines_followup table
CREATE TABLE IF NOT EXISTS machines_followup (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  serial_number VARCHAR(150) NOT NULL,
  product_model VARCHAR(150) NULL,
  followed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  next_followup_date TIMESTAMP NOT NULL,
  added_by VARCHAR(100) NOT NULL,
  notes TEXT NULL,
  image VARCHAR(255) NULL,
  contact VARCHAR(255) NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_serial_number (serial_number),
  INDEX idx_added_by (added_by),
  INDEX idx_followed_at (followed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MySQL: Alter table for existing tables (to migrate from email/phone to contact)
ALTER TABLE machines_followup 
ADD COLUMN IF NOT EXISTS contact VARCHAR(255) NULL FIRST;

