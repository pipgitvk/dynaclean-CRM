-- Add gem_price field to products_list table
ALTER TABLE products_list ADD COLUMN gem_price DECIMAL(10, 2) DEFAULT 0 AFTER price_per_unit;
