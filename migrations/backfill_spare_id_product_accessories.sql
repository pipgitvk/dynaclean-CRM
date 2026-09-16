-- Backfill spare_id on existing product_accessories rows.
-- Run AFTER add_spare_id_package_status_to_product_accessories.sql
--
-- Matching order:
--   1) spare_number / id parsed from accessory_name suffix, e.g. "Battery (1112)"
--   2) spare_list.item_name = accessory name without "(spare_number)" suffix
--   3) spare_list.item_name = full accessory_name
--
-- Safe to re-run: only updates rows where spare_id IS NULL.

-- ---------------------------------------------------------------------------
-- 1) Match by number in parentheses at end of accessory_name
-- ---------------------------------------------------------------------------
UPDATE product_accessories pa
INNER JOIN spare_list sl ON (
  CAST(sl.spare_number AS CHAR) = TRIM(TRAILING ')' FROM SUBSTRING_INDEX(pa.accessory_name, '(', -1))
  OR CAST(sl.id AS CHAR) = TRIM(TRAILING ')' FROM SUBSTRING_INDEX(pa.accessory_name, '(', -1))
)
SET pa.spare_id = sl.id
WHERE pa.spare_id IS NULL
  AND pa.accessory_name LIKE '%(%'
  AND TRIM(TRAILING ')' FROM SUBSTRING_INDEX(pa.accessory_name, '(', -1)) != pa.accessory_name;

-- ---------------------------------------------------------------------------
-- 2) Match by item_name (name part before parentheses)
-- ---------------------------------------------------------------------------
UPDATE product_accessories pa
INNER JOIN (
  SELECT MIN(id) AS id, LOWER(TRIM(item_name)) AS name_key
  FROM spare_list
  GROUP BY LOWER(TRIM(item_name))
) sl ON sl.name_key = LOWER(TRIM(
  CASE
    WHEN pa.accessory_name LIKE '%(%'
      THEN TRIM(TRAILING ')' FROM SUBSTRING_INDEX(pa.accessory_name, '(', 1))
    ELSE pa.accessory_name
  END
))
SET pa.spare_id = sl.id
WHERE pa.spare_id IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Match by full accessory_name
-- ---------------------------------------------------------------------------
UPDATE product_accessories pa
INNER JOIN (
  SELECT MIN(id) AS id, LOWER(TRIM(item_name)) AS name_key
  FROM spare_list
  GROUP BY LOWER(TRIM(item_name))
) sl ON sl.name_key = LOWER(TRIM(pa.accessory_name))
SET pa.spare_id = sl.id
WHERE pa.spare_id IS NULL;

-- ---------------------------------------------------------------------------
-- Review unmatched rows (manual fix in Product Accessories UI if any remain)
-- ---------------------------------------------------------------------------
-- SELECT id, product_code, accessory_name, spare_id
-- FROM product_accessories
-- WHERE spare_id IS NULL
-- ORDER BY product_code, accessory_name;
