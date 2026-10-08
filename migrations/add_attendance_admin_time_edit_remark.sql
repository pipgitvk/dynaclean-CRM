ALTER TABLE attendance_log_edit_history
  ADD COLUMN edit_remark VARCHAR(512) NULL AFTER changes_json;

ALTER TABLE attendance_logs
  ADD COLUMN admin_time_edit_remark VARCHAR(512) NULL;
