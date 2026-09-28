-- Covered in Warranty on spare_list (Y / N, blank until selected)
-- Run once manually. If the column already exists, skip this statement.

ALTER TABLE spare_list
  ADD COLUMN covered_in_warranty CHAR(1) NULL DEFAULT NULL
  COMMENT 'Y = covered in warranty, N = not covered, NULL = not selected'
  AFTER spare_number;
