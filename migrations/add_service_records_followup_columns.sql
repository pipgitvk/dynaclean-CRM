-- Follow-up fields on service_records (Service History / view_service_reports)
-- App auto-runs ensureServiceRecordsFollowupColumns(); use this only for manual DB setup.
ALTER TABLE service_records ADD COLUMN mail_sent TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE service_records ADD COLUMN final_feedback_on_call TEXT NULL;
ALTER TABLE service_records ADD COLUMN service_rating TINYINT UNSIGNED NULL COMMENT '0-5 stars';
ALTER TABLE service_records ADD COLUMN service_followup_at DATETIME NULL;
