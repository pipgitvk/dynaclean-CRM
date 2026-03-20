-- Links each prospect row to a specific neworder for correct Status vs payment + commitment_date.
ALTER TABLE prospects ADD COLUMN order_id VARCHAR(64) NULL;
ALTER TABLE prospects ADD INDEX idx_prospects_order_id (order_id);
