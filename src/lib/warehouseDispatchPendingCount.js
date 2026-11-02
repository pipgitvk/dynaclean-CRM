import { sqlQuoteTrimEqColumns } from "@/lib/sqlQuoteMatch";

/**
 * SQL: dispatch row is AMC/CAMC/service/installation/maintenance (no warehouse dispatch).
 * Mirrors isNonDispatchQuotationLine / isServiceCharge in dispatchSerialRules.js.
 */
export const DISPATCH_ROW_IS_NON_DISPATCH_SERVICE_SQL = `(
  LOWER(COALESCE(item_name, '')) LIKE '%camc%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%amc%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%cmc%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%charges%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%service%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%labour%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%labor%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%installation%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%maintenance%'
  OR LOWER(COALESCE(item_name, '')) LIKE '%inst.%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%camc%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%amc%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%cmc%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%charges%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%service%'
  OR LOWER(COALESCE(item_code, '')) LIKE '%maintenance%'
)`;

/** @param {string} [tableAlias] e.g. "d" → d.serial_no */
function dispatchRowIsNonDispatchServiceSql(tableAlias) {
  const p = tableAlias ? `${tableAlias}.` : "";
  return DISPATCH_ROW_IS_NON_DISPATCH_SERVICE_SQL.replace(
    /\bitem_name\b/g,
    `${p}item_name`,
  ).replace(/\bitem_code\b/g, `${p}item_code`);
}

/** Open dispatch units that warehouse must fulfill (serial / stock). */
export function dispatchWarehousePendingWhere(tableAlias = "") {
  const p = tableAlias ? `${tableAlias}.` : "";
  return `
  (${p}serial_no IS NULL OR TRIM(${p}serial_no) = '')
  AND COALESCE(${p}stock_deducted, 0) = 0
  AND NOT ${dispatchRowIsNonDispatchServiceSql(tableAlias)}
`;
}

/** @deprecated use dispatchWarehousePendingWhere() */
export const DISPATCH_WAREHOUSE_PENDING_WHERE = dispatchWarehousePendingWhere();

export const ORDER_NOT_CANCELLED_SQL = `(no.is_cancelled = 0 OR no.is_cancelled IS NULL)`;

/** Orders not yet marked dispatch-complete on neworder. */
export const ORDER_DISPATCH_NOT_COMPLETE_SQL = `COALESCE(no.dispatch_status, 0) = 0`;

/** @param {import("mysql2/promise").PoolConnection} conn */
export async function countWarehouseDispatchPending(conn) {
  const whereD = dispatchWarehousePendingWhere("d");
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS dispatchPendings
     FROM dispatch d
     INNER JOIN neworder no ON ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
     WHERE ${whereD}
       AND ${ORDER_NOT_CANCELLED_SQL}
       AND ${ORDER_DISPATCH_NOT_COMPLETE_SQL}`,
  );
  return Number(rows[0]?.dispatchPendings ?? 0);
}
