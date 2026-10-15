-- Link return_products to sales order + order processor (neworder.created_by)
ALTER TABLE return_products
  ADD COLUMN IF NOT EXISTS order_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS order_created_by VARCHAR(100) NULL;

CREATE INDEX IF NOT EXISTS idx_return_products_order_id ON return_products (order_id);
