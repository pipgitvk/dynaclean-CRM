-- Add attachment path for regularization proof (run once if table already exists without this column).

ALTER TABLE attendance_regularization_requests
  ADD COLUMN attachment_url VARCHAR(1024) NULL;
