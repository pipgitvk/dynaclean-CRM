-- Create asset_categories table for dynamic asset categories
CREATE TABLE IF NOT EXISTS asset_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_name VARCHAR(100) NOT NULL,
  category_type ENUM('Device', 'Accessory') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_category (category_name, category_type),
  INDEX idx_category_type (category_type)
);

-- Insert default categories
INSERT INTO asset_categories (category_name, category_type) VALUES
-- Device categories
('Mobile', 'Device'),
('Laptop', 'Device'),
('Desktop', 'Device'),
('Monitor', 'Device'),
('CPU', 'Device'),
('Printer', 'Device'),
('Tablet', 'Device'),
-- Accessory categories
('SIM', 'Accessory'),
('Keyboard', 'Accessory'),
('Mouse', 'Accessory'),
('Pendrive', 'Accessory'),
('Headphones', 'Accessory'),
('Charger', 'Accessory'),
('ExternalHardDisk', 'Accessory'),
('UPS', 'Accessory'),
('Router', 'Accessory'),
('Dongle', 'Accessory')
ON DUPLICATE KEY UPDATE category_name = category_name;
