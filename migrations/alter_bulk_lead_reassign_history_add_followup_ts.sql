-- If table was created without followup_time_stamp, run this once:
ALTER TABLE bulk_lead_reassign_history
  ADD COLUMN IF NOT EXISTS followup_time_stamp DATETIME NULL AFTER source;