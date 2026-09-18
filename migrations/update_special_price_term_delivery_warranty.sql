-- Update old price_term value to new wording
UPDATE special_price
SET price_term = 'with delivery and warranty'
WHERE price_term = 'with price and delivery'
   OR price_term IS NULL
   OR TRIM(price_term) = '';
