ALTER TABLE third_party_service_engineers
  ADD COLUMN secondary_contact_number VARCHAR(20) NULL AFTER mobile,
  ADD COLUMN service_charge DECIMAL(10, 2) NULL AFTER remark;
