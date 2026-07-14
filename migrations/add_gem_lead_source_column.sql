-- Add gem_lead_source column to customers table
ALTER TABLE customers ADD COLUMN gem_lead_source VARCHAR(255) NULL AFTER service_lead_source;

-- Add comment to describe the column
ALTER TABLE customers MODIFY gem_lead_source VARCHAR(255) NULL COMMENT 'GEM employee assigned to this customer/lead';

-- Add index for faster queries
CREATE INDEX idx_gem_lead_source ON customers(gem_lead_source);
