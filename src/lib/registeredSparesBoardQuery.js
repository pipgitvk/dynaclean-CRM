import {
  UTF8_COLLATE,
  sqlTrimUtf8EqColumns,
} from "@/lib/sqlUtf8Compare";
import { pendingNeworderPredicates } from "@/lib/upcomingInstallationOrderEligibility";
import { buildRegisteredSparesRowIsProductSql } from "@/lib/registeredSpareWarrantySql";

function unionChar(expr) {
  return `CAST(${expr} AS CHAR CHARACTER SET utf8mb4) COLLATE ${UTF8_COLLATE}`;
}

export const NOT_DISPATCH_PRODUCT = `NOT EXISTS (
  SELECT 1 FROM products_list pl
  WHERE ${sqlTrimUtf8EqColumns("pl.item_code", "d.item_code")}
)`;

const RS_JOIN_ON_DISPATCH = `
  LEFT JOIN registered_spares rs
    ON rs.dispatch_id = d.id
    OR (
      rs.dispatch_id IS NULL
      AND ${sqlTrimUtf8EqColumns("rs.order_id", "no.order_id")}
      AND ${sqlTrimUtf8EqColumns("rs.spare_item_code", "d.item_code")}
    )
`;

export const SPARE_PIPELINE_BASE_FROM = `
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

export const SPARE_BOARD_PIPELINE_FROM = `
  ${SPARE_PIPELINE_BASE_FROM}
  ${RS_JOIN_ON_DISPATCH}
`;

export const SPARE_BOARD_PIPELINE_WHERE = `
  WHERE ${pendingNeworderPredicates("no")}
    AND ${NOT_DISPATCH_PRODUCT}
`;

const BOARD_ROW_SELECT = `
  SELECT
    ${unionChar("CONCAT('d-', d.id)")} AS rowKey,
    d.id AS dispatch_id,
    ${unionChar("no.order_id")} AS order_id,
    ${unionChar("no.quote_number")} AS quote_number,
    ${unionChar("d.item_code")} AS spare_item_code,
    ${unionChar("d.item_name")} AS spare_item_name,
    ${unionChar("COALESCE(NULLIF(TRIM(rs.spare_item_name), ''), d.item_name)")} AS product_name,
    ${unionChar("d.item_code")} AS model,
    ${unionChar(
      "COALESCE(NULLIF(TRIM(rs.serial_number), ''), NULLIF(TRIM(d.serial_no), ''), NULLIF(TRIM(wp.serial_number), ''))",
    )} AS serial_number,
    ${unionChar("COALESCE(rs.customer_name, wp.customer_name, no.company_name)")} AS customer_name,
    ${unionChar("COALESCE(rs.contact, wp.contact, no.contact)")} AS contact,
    ${unionChar("COALESCE(rs.contact_person, wp.contact_person)")} AS contact_person,
    ${unionChar("COALESCE(rs.invoice_number, wp.invoice_number, no.invoice_number)")} AS invoice_number,
    ${unionChar("COALESCE(rs.installed_by, wp.installed_by)")} AS installed_by,
    ${unionChar("COALESCE(rs.spare_installation_status, wp.spare_installation_status)")} AS spare_installation_status,
    ${unionChar("rs.installation_completed_by")} AS installation_completed_by,
    rs.installation_completed_date,
    rs.id AS registered_spare_id,
    rs.created_at,
    CASE
      WHEN rs.warranty_product_id IS NOT NULL OR wp.id IS NOT NULL THEN 1
      ELSE 0
    END AS warranty_registered
`;

const RS_ORPHAN_SELECT = `
  SELECT
    ${unionChar("CONCAT('rs-', rs.id)")} AS rowKey,
    rs.dispatch_id,
    ${unionChar("rs.order_id")} AS order_id,
    ${unionChar("rs.quote_number")} AS quote_number,
    ${unionChar("COALESCE(rs.spare_item_code, rs.model)")} AS spare_item_code,
    ${unionChar("COALESCE(rs.spare_item_name, rs.product_name)")} AS spare_item_name,
    ${unionChar("COALESCE(rs.spare_item_name, rs.product_name)")} AS product_name,
    ${unionChar("COALESCE(rs.spare_item_code, rs.model)")} AS model,
    ${unionChar("rs.serial_number")} AS serial_number,
    ${unionChar("rs.customer_name")} AS customer_name,
    ${unionChar("rs.contact")} AS contact,
    ${unionChar("rs.contact_person")} AS contact_person,
    ${unionChar("rs.invoice_number")} AS invoice_number,
    ${unionChar("rs.installed_by")} AS installed_by,
    ${unionChar("rs.spare_installation_status")} AS spare_installation_status,
    ${unionChar("rs.installation_completed_by")} AS installation_completed_by,
    rs.installation_completed_date,
    rs.id AS registered_spare_id,
    rs.created_at,
    CASE WHEN rs.warranty_product_id IS NOT NULL THEN 1 ELSE 0 END AS warranty_registered
`;

const RS_ORPHAN_FROM = `
  FROM registered_spares rs
  LEFT JOIN warranty_products wp ON wp.id = rs.warranty_product_id
`;

const RS_ORPHAN_NOT_ON_PIPELINE = `NOT EXISTS (
  SELECT 1
  FROM neworder no
  INNER JOIN dispatch d
    ON ${sqlTrimUtf8EqColumns("d.quote_number", "no.quote_number")}
  INNER JOIN spare_list sl
    ON ${sqlTrimUtf8EqColumns("sl.spare_number", "d.item_code")}
  WHERE ${pendingNeworderPredicates("no")}
    AND ${NOT_DISPATCH_PRODUCT}
    AND (
      rs.dispatch_id = d.id
      OR (
        rs.dispatch_id IS NULL
        AND ${sqlTrimUtf8EqColumns("rs.order_id", "no.order_id")}
        AND ${sqlTrimUtf8EqColumns("rs.spare_item_code", "d.item_code")}
      )
    )
)`;

export function buildSpareBoardRegistrationClause(registration) {
  const v = String(registration || "all").toLowerCase();
  if (v === "registered") return "warranty_registered = 1";
  if (v === "unregistered") return "warranty_registered = 0";
  return "1=1";
}

export function buildSpareBoardSearchClause(search) {
  const q = String(search || "").trim();
  if (!q) return { sql: "", params: [] };
  const like = `%${q}%`;
  return {
    sql: `(
      product_name LIKE ? OR model LIKE ? OR spare_item_code LIKE ?
      OR spare_item_name LIKE ? OR serial_number LIKE ?
      OR customer_name LIKE ? OR order_id LIKE ? OR quote_number LIKE ?
      OR invoice_number LIKE ? OR contact LIKE ?
    )`,
    params: Array(10).fill(like),
  };
}

/**
 * Fast board list: open spare dispatch lines + registered_spares not on open pipeline.
 */
export function buildSpareBoardListSql({ includeOrphans = true } = {}) {
  const spareOnlyRs = `NOT ${buildRegisteredSparesRowIsProductSql()}`;
  const pipeline = `
    ${BOARD_ROW_SELECT}
    ${SPARE_BOARD_PIPELINE_FROM}
    ${SPARE_BOARD_PIPELINE_WHERE}
  `;
  if (!includeOrphans) {
    return pipeline;
  }
  return `
    SELECT * FROM (
      ${pipeline}
      UNION ALL
      ${RS_ORPHAN_SELECT}
      ${RS_ORPHAN_FROM}
      WHERE ${spareOnlyRs}
        AND ${RS_ORPHAN_NOT_ON_PIPELINE}
    ) spare_board
  `;
}

export function buildSpareBoardStatsSql() {
  const inner = buildSpareBoardListSql({ includeOrphans: true });
  return `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN warranty_registered = 1 THEN 1 ELSE 0 END) AS registered,
      SUM(CASE WHEN warranty_registered = 0 THEN 1 ELSE 0 END) AS not_registered
    FROM (${inner}) stats_src
  `;
}