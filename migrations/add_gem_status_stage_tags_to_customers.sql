-- GEM follow-up fields on customers table
ALTER TABLE customers
  ADD COLUMN gem_status VARCHAR(50) NULL,
  ADD COLUMN gem_stage VARCHAR(100) NULL DEFAULT 'New',
  ADD COLUMN gem_tags VARCHAR(255) NULL;
