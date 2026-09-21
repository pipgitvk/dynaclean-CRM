-- Service Support fields on customers table
ALTER TABLE customers
  ADD COLUMN service_status VARCHAR(50) NULL,
  ADD COLUMN service_stage VARCHAR(100) NULL DEFAULT 'New',
  ADD COLUMN service_tags VARCHAR(255) NULL;
