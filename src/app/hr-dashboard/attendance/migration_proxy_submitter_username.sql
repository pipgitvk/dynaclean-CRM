-- Overtime flow: regularization filed by a reporting manager for a reportee is approved by the submitter's manager.
-- Run once if the app cannot auto-ALTER (restricted DB user).

ALTER TABLE attendance_regularization_requests
ADD COLUMN proxy_submitter_username VARCHAR(255) NULL DEFAULT NULL;
