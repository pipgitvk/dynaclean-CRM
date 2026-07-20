-- Add return_image column to return_products table
ALTER TABLE return_products 
ADD COLUMN IF NOT EXISTS return_image VARCHAR(500) NULL AFTER reason;
