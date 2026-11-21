import { sqlTrimUtf8EqColumns, sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

/** Pre-aggregate dispatched spare serials (faster than correlated EXISTS per row). */
export const DISPATCHED_SPARE_SERIALS_JOIN = `
  LEFT JOIN (
    SELECT DISTINCT ${sqlUtf8TrimExpr("d.serial_no")} AS spare_serial
    FROM dispatch d
    INNER JOIN spare_list sl
      ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}
    WHERE d.serial_no IS NOT NULL
      AND TRIM(d.serial_no) <> ''
  ) spare_dispatch
    ON ${sqlTrimUtf8EqColumns("spare_dispatch.spare_serial", "wp.serial_number")}
`;

/**
 * @param {{ hasInstalledBy?: boolean, useDispatchJoin?: boolean }} [opts]
 */
export function buildWarrantyProductIsSpareSql({
  hasInstalledBy = true,
  useDispatchJoin = false,
} = {}) {
  const installedByClause = hasInstalledBy
    ? `(wp.installed_by IS NOT NULL AND TRIM(wp.installed_by) <> '') OR `
    : "";

  const dispatchMatch = useDispatchJoin
    ? `(spare_dispatch.spare_serial IS NOT NULL)`
  : `EXISTS (
    SELECT 1
    FROM dispatch d
    INNER JOIN spare_list sl
      ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}
    WHERE ${sqlTrimUtf8EqColumns("d.serial_no", "wp.serial_number")}
      AND d.serial_no IS NOT NULL
      AND TRIM(d.serial_no) <> ''
  )`;

  return `(
  ${installedByClause}(
    wp.serial_number IS NOT NULL
    AND TRIM(wp.serial_number) <> ''
    AND (
      wp.warranty_period IS NULL
      OR TRIM(CAST(COALESCE(wp.warranty_period, '') AS CHAR)) = ''
      OR CAST(wp.warranty_period AS UNSIGNED) = 0
    )
  )
  OR ${dispatchMatch}
)`;
}

/** @param {Parameters<typeof buildWarrantyProductIsSpareSql>[0]} [opts] */
export function buildWarrantyProductIsProductSql(opts = {}) {
  return `NOT ${buildWarrantyProductIsSpareSql(opts)}`;
}

/** Main product item codes — spare rows must not match these (same as upcoming spares). */
export function buildWarrantyProductIsNotMainProductSql() {
  return `NOT EXISTS (
    SELECT 1 FROM products_list pl
    WHERE ${sqlTrimUtf8EqColumns("pl.item_code", "wp.model")}
  )`;
}

/**
 * Warranty rows eligible for registered_spares (spares only; excludes products_list items).
 * @param {{ hasInstalledBy?: boolean, spareSerialAlias?: string }} [opts]
 */
export function buildRegisteredSparesWarrantyRowSql({
  hasInstalledBy = true,
  spareSerialAlias = "ds",
} = {}) {
  const installedBy = hasInstalledBy
    ? `(wp.installed_by IS NOT NULL AND TRIM(wp.installed_by) <> '')`
    : "0";
  const dispatchMatch = `(${spareSerialAlias}.spare_serial IS NOT NULL)`;
  return `(
    (${installedBy} OR ${dispatchMatch})
    AND ${buildWarrantyProductIsNotMainProductSql()}
  )`;
}

export function buildRegisteredSparesRowIsProductSql() {
  return `EXISTS (
    SELECT 1 FROM products_list pl
    WHERE ${sqlTrimUtf8EqColumns(
      "pl.item_code",
      "COALESCE(rs.spare_item_code, rs.model, wp.model)",
    )}
  )`;
}