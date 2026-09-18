-- Run once on the DB: price_type and price_term on special_price.
-- Existing rows: price_type = 'special price', price_term = 'with delivery and warranty'

ALTER TABLE special_price
ADD COLUMN IF NOT EXISTS price_type VARCHAR(100) NULL AFTER special_price,
ADD COLUMN IF NOT EXISTS price_term VARCHAR(100) NULL AFTER price_type;

UPDATE special_price
SET price_type = 'special price'
WHERE price_type IS NULL OR TRIM(price_type) = '';

UPDATE special_price
SET price_term = 'with delivery and warranty'
WHERE price_term IS NULL OR TRIM(price_term) = '';
