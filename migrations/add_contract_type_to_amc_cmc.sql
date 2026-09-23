-- Add contract type (AMC / CMC) to amc_cmc records
ALTER TABLE amc_cmc
  ADD COLUMN contract_type ENUM('AMC', 'CMC') NOT NULL DEFAULT 'AMC' AFTER serial_number;
