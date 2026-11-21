import { UTF8_COLLATE, sqlTrimUtf8EqColumns } from "@/lib/sqlUtf8Compare";
import { pendingNeworderPredicates } from "@/lib/upcomingInstallationOrderEligibility";

/** Same charset/collation on both UNION branches (avoids ER_CANT_AGGREGATE_NCOLLATIONS). */
function unionChar(expr) {
  return `CAST(${expr} AS CHAR CHARACTER SET utf8mb4) COLLATE ${UTF8_COLLATE}`;
}

function unionNullChar() {
  return `CAST(NULL AS CHAR CHARACTER SET utf8mb4) COLLATE ${UTF8_COLLATE}`;
}

/** Dispatch spare line with optional warranty row (upcoming spares tab, per line). */
function unionDispatchRowSelect() {
  return `
      wp.id,
      ${unionChar("COALESCE(wp.product_name, d.item_name)")} AS product_name,
      ${unionChar("COALESCE(wp.model, d.item_code)")} AS model,
      ${unionChar("COALESCE(wp.serial_number, d.serial_no)")} AS serial_number,
      ${unionChar("COALESCE(wp.customer_name, no.company_name)")} AS customer_name,
      ${unionChar("wp.contact_person")} AS contact_person,
      ${unionChar("COALESCE(wp.contact, no.contact)")} AS contact,
      ${unionChar("wp.installed_by")} AS installed_by,
      ${unionChar("wp.spare_installation_status")} AS spare_installation_status,
      ${unionChar("wp.installation_completed_by")} AS installation_completed_by,
      wp.installation_completed_date,
      ${unionChar("COALESCE(wp.invoice_number, no.invoice_number)")} AS invoice_number,
      COALESCE(wp.invoice_date, no.invoice_date) AS invoice_date,
      wp.created_at,
      ${unionChar("COALESCE(wp.created_by, no.created_by)")} AS created_by,
      CASE WHEN wp.id IS NOT NULL THEN 1 ELSE 0 END AS warranty_registered
  `;
}

function unionWarrantyOnlyRowSelect() {
  return `
      wp.id,
      ${unionChar("wp.product_name")} AS product_name,
      ${unionChar("wp.model")} AS model,
      ${unionChar("wp.serial_number")} AS serial_number,
      ${unionChar("wp.customer_name")} AS customer_name,
      ${unionChar("wp.contact_person")} AS contact_person,
      ${unionChar("wp.contact")} AS contact,
      ${unionChar("wp.installed_by")} AS installed_by,
      ${unionChar("wp.spare_installation_status")} AS spare_installation_status,
      ${unionChar("wp.installation_completed_by")} AS installation_completed_by,
      wp.installation_completed_date,
      ${unionChar("wp.invoice_number")} AS invoice_number,
      wp.invoice_date,
      wp.created_at,
      ${unionChar("wp.created_by")} AS created_by,
      1 AS warranty_registered
  `;
}

/**
 * Open installation pipeline — same spare dispatch universe as upcoming ?type=spares
 * (LEFT JOIN warranty so unregistered spare lines still list).
 */
export const SPARE_DISPATCH_PIPELINE_FROM = `
  FROM neworder no
  INNER JOIN dispatch d
    ON ${sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number")}
  INNER JOIN spare_list sl
    ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}
  LEFT JOIN warranty_products wp
    ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
    AND d.serial_no IS NOT NULL
    AND TRIM(d.serial_no) <> ''
`;

export const DISPATCH_ITEM_IS_NOT_PRODUCT_SQL = `
  NOT EXISTS (
    SELECT 1 FROM products_list pl
    WHERE ${sqlTrimUtf8EqColumns("pl.item_code", "d.item_code")}
  )
`;

export const SPARE_DISPATCH_PIPELINE_WHERE = `
  WHERE ${pendingNeworderPredicates("no")}
    AND ${DISPATCH_ITEM_IS_NOT_PRODUCT_SQL}
`;

export function buildWarrantyRowIsSpareSql({ hasInstalledBy = true } = {}) {
  const installedBySpare = hasInstalledBy
    ? `(
      wp.installed_by IS NOT NULL
      AND TRIM(wp.installed_by) <> ''
    )`
    : "0";
  return `(
    ${installedBySpare}
    OR (
      COALESCE(CAST(wp.warranty_period AS UNSIGNED), 0) = 0
    )
    OR wp.warranty_period IS NULL
    OR TRIM(CAST(COALESCE(wp.warranty_period, '') AS CHAR)) = ''
  )`;
}

const SPARE_DISPATCH_SEARCH_FIELDS = [
  "d.item_code",
  "d.item_name",
  "d.serial_no",
  "d.quote_number",
  "no.order_id",
  "no.company_name",
  "no.invoice_number",
  "wp.product_name",
  "wp.serial_number",
  "wp.customer_name",
];

export function buildRegisteredSpareDispatchSearchClause(search) {
  const raw = String(search || "").trim();
  if (!raw) return { sql: "", params: [] };
  const like = `%${raw}%`;
  const parts = SPARE_DISPATCH_SEARCH_FIELDS.map((f) => `${f} LIKE ?`);
  return {
    sql: `(${parts.join(" OR ")})`,
    params: SPARE_DISPATCH_SEARCH_FIELDS.map(() => like),
  };
}

const REGISTERED_SPARE_WARRANTY_SEARCH_FIELDS = [
  "wp.product_name",
  "wp.model",
  "wp.customer_name",
  "wp.invoice_number",
  "wp.contact_person",
];

export function buildRegisteredSpareWarrantySearchClause(search) {
  const raw = String(search || "").trim();
  if (!raw) return { sql: "", params: [] };
  const like = `%${raw}%`;
  const parts = REGISTERED_SPARE_WARRANTY_SEARCH_FIELDS.map((f) => `${f} LIKE ?`);
  return {
    sql: `(${parts.join(" OR ")})`,
    params: REGISTERED_SPARE_WARRANTY_SEARCH_FIELDS.map(() => like),
  };
}

export function registeredSpareDispatchSelectSql() {
  return `
    SELECT
      d.id AS dispatch_id,
      ${unionChar("d.quote_number")} AS quote_number,
      ${unionChar("d.item_code")} AS spare_item_code,
      ${unionChar("d.item_name")} AS spare_item_name,
      ${unionChar("d.serial_no")} AS dispatch_serial,
      ${unionChar("no.order_id")} AS order_id,
      ${unionChar("no.company_name")} AS order_company_name,
      ${unionDispatchRowSelect()}
  `;
}

export function registeredSpareNoSerialSelectSql() {
  return `
    SELECT
      NULL AS dispatch_id,
      ${unionNullChar()} AS quote_number,
      ${unionChar("wp.model")} AS spare_item_code,
      ${unionChar("wp.product_name")} AS spare_item_name,
      ${unionNullChar()} AS dispatch_serial,
      ${unionNullChar()} AS order_id,
      ${unionNullChar()} AS order_company_name,
      ${unionWarrantyOnlyRowSelect()}
  `;
}

export function buildRegisteredSparesUnionSql(dispatchWhereSql, noSerialWhereSql) {
  return `
    (
      ${registeredSpareDispatchSelectSql()}
      ${SPARE_DISPATCH_PIPELINE_FROM}
      ${dispatchWhereSql}
      UNION ALL
      ${registeredSpareNoSerialSelectSql()}
      FROM warranty_products wp
      ${noSerialWhereSql}
    ) AS registered_spares
  `;
}