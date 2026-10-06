ALTER TABLE service_records
  ADD COLUMN third_party_engineer_id INT NULL COMMENT 'third_party_service_engineers.engineer_id' AFTER assigned_to_id,
  ADD INDEX idx_sr_third_party_engineer_id (third_party_engineer_id);
