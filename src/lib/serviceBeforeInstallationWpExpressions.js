import { sqlTrimUtf8EqColumns, sqlUtf8HasText } from "@/lib/sqlUtf8Compare";

const INSTALLATION_SR_ORDER = `
  ORDER BY
    CASE
      WHEN UPPER(TRIM(COALESCE(sr.status, ''))) IN ('COMPLETED', 'WORKED') THEN 0
      ELSE 1
    END,
    sr.service_id DESC
  LIMIT 1`;

const INSTALLATION_SR_BASE = `
  AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
  AND UPPER(TRIM(COALESCE(sr.assigned_to, ''))) NOT IN ('', 'NOT ASSIGNED', 'UNASSIGNED')`;

/** Sales person shown in hub table: order creator, else registration creator. */
export function wpOrderSalesPersonExpr() {
  return `COALESCE(
    (
      SELECT no.created_by
      FROM dispatch d
      INNER JOIN neworder no
        ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
      WHERE ${sqlTrimUtf8EqColumns("d.serial_no", "wp.serial_number")}
        AND ${sqlUtf8HasText("no.created_by")}
      ORDER BY no.id DESC
      LIMIT 1
    ),
    (
      SELECT no.created_by
      FROM neworder no
      WHERE ${sqlUtf8HasText("wp.invoice_number")}
        AND ${sqlTrimUtf8EqColumns("no.invoice_number", "wp.invoice_number")}
        AND ${sqlUtf8HasText("no.created_by")}
      ORDER BY no.id DESC
      LIMIT 1
    ),
    wp.created_by
  )`;
}

function wpInstallationEngineerSubquery({ engineerKind = "any" } = {}) {
  let typeSql = "";
  if (engineerKind === "internal") {
    typeSql = ` AND LOWER(TRIM(COALESCE(sr.assigned_to_type, 'internal'))) <> 'third_party'`;
  } else if (engineerKind === "third_party") {
    typeSql = ` AND LOWER(TRIM(COALESCE(sr.assigned_to_type, ''))) = 'third_party'`;
  }
  return `(
    SELECT sr.assigned_to
    FROM service_records sr
    WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
      ${INSTALLATION_SR_BASE}
      ${typeSql}
    ${INSTALLATION_SR_ORDER}
  )`;
}

/** Latest assigned internal engineer on installation service record. */
export function wpServiceEngineerExpr() {
  return wpInstallationEngineerSubquery({ engineerKind: "internal" });
}

/** Latest assigned third-party engineer on installation service record. */
export function wpThirdPartyEngineerExpr() {
  return wpInstallationEngineerSubquery({ engineerKind: "third_party" });
}

/**
 * Registered product — installation completed (INSTALLATION SR status COMPLETED only).
 * WORKED, PLANNED, PENDING, etc. count as pending.
 */
export const WP_INSTALLATION_SR_DONE_SQL = `EXISTS (
  SELECT 1
  FROM service_records sr
  WHERE ${sqlTrimUtf8EqColumns("sr.serial_number", "wp.serial_number")}
    AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
    AND UPPER(TRIM(COALESCE(sr.status, ''))) = 'COMPLETED'
)`;

export const INSTALLED_AFTER_REGISTERED_SQL = `(${WP_INSTALLATION_SR_DONE_SQL})`;

export const INSTALLATION_PENDING_AFTER_REGISTERED_SQL = `(NOT (${INSTALLED_AFTER_REGISTERED_SQL}))`;

/** Combined engineer (legacy display) — internal preferred, else third party. */
export function wpInstallationEngineerExpr() {
  return `COALESCE(${wpServiceEngineerExpr()}, ${wpThirdPartyEngineerExpr()})`;
}