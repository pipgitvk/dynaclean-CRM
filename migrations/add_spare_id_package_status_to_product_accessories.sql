-- Add spare_id and package_status to product_accessories
-- package_status: 'available' = in package (checklist only), 'added' = dispatch separately (auto dispatch row)

ALTER TABLE product_accessories
  ADD COLUMN spare_id INT DEFAULT NULL COMMENT 'FK to spare_list.id' AFTER product_code,
  ADD COLUMN package_status ENUM('available', 'added') NOT NULL DEFAULT 'available'
    COMMENT 'available=in package checklist, added=separate dispatch row' AFTER qty;

ALTER TABLE product_accessories
  ADD KEY idx_spare_id (spare_id);
