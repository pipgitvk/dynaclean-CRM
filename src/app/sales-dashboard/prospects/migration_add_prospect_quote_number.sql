ALTER TABLE prospects ADD COLUMN quote_number VARCHAR(100) NULL;
ALTER TABLE prospects ADD INDEX idx_prospects_quote_number (quote_number);
