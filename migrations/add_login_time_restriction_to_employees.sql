-- Per-employee login time window (09:00–19:00 IST) when enabled (default ON)
ALTER TABLE rep_list
  ADD COLUMN login_time_restriction_enabled TINYINT(1) NOT NULL DEFAULT 1;

ALTER TABLE emplist
  ADD COLUMN login_time_restriction_enabled TINYINT(1) NOT NULL DEFAULT 1;
