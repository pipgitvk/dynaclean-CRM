/**
 * Shared PAT quotation line classifiers (quotation_items aliased as `qi`).
 * Used by adminPatSummary aggregations and order item drill-down API.
 */

/** Machine / product master lines (not AMC/CAMC service SKUs). */
export const PAT_PHYSICAL_PRODUCT_LINE_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM products_list pl
      WHERE (
          TRIM(pl.item_code) = TRIM(qi.item_code)
          OR CAST(pl.product_number AS CHAR) = TRIM(qi.item_code)
        )
        AND UPPER(TRIM(COALESCE(pl.item_name, ''))) NOT IN ('AMC', 'CAMC')
        AND UPPER(TRIM(COALESCE(pl.item_code, ''))) NOT IN ('AMC', 'CAMC', 'CMC')
    )
    OR (
      TRIM(COALESCE(qi.item_code, '')) REGEXP '[A-Za-z]'
      AND UPPER(TRIM(qi.item_code)) NOT IN ('AMC', 'CAMC', 'CMC')
      AND UPPER(TRIM(COALESCE(qi.item_name, ''))) NOT IN ('AMC', 'CAMC')
      AND UPPER(COALESCE(qi.item_name, '')) NOT LIKE '%CAMC%'
      AND UPPER(COALESCE(qi.item_name, '')) NOT LIKE '%COMPREHENSIVE MAINTENANCE%'
      AND UPPER(COALESCE(qi.item_name, '')) NOT LIKE '%ANNUAL MAINTENANCE CONTRACT%'
    )
  )
`;

const AMC_CAMC_LINE_CORE_SQL = `
  (
    UPPER(TRIM(qi.item_code)) IN ('AMC', 'CAMC', 'CMC')
    OR UPPER(TRIM(qi.item_name)) IN ('AMC', 'CAMC')
    OR UPPER(qi.item_name) LIKE '%CAMC%'
    OR UPPER(qi.item_name) LIKE '%COMPREHENSIVE MAINTENANCE%'
    OR UPPER(qi.item_name) LIKE '%ANNUAL MAINTENANCE CONTRACT%'
    OR EXISTS (
      SELECT 1
      FROM products_list pl
      WHERE (
          TRIM(pl.item_code) = TRIM(qi.item_code)
          OR CAST(pl.product_number AS CHAR) = TRIM(qi.item_code)
        )
        AND (
          UPPER(TRIM(pl.item_name)) IN ('AMC', 'CAMC')
          OR UPPER(TRIM(pl.item_code)) IN ('AMC', 'CAMC', 'CMC')
        )
    )
  )
`;

/**
 * AMC/CAMC lines: quotation item_code may be SKU (AMC/CAMC) or products_list.item_code
 * (e.g. 1002500173) with item_name AMC/CAMC. Physical products are excluded.
 */
export const AMC_ITEM_MATCH_SQL = `
  (
    ${AMC_CAMC_LINE_CORE_SQL}
    AND NOT (${PAT_PHYSICAL_PRODUCT_LINE_SQL})
  )
`;

/** Service / repair income spares (e.g. spare_number 1110 Service Maintenance Charges). */
export const MACHINE_REPAIR_SPARE_MATCH_SQL = `
  (
    NOT (${AMC_ITEM_MATCH_SQL})
    AND (
      EXISTS (
        SELECT 1
        FROM spare_list sl
        WHERE (
            CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
            OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
          )
          AND (
            UPPER(sl.item_name) LIKE '%SERVICE%MAINTEN%'
            OR UPPER(sl.item_name) LIKE '%MAINTENECE%CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPARING CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPAIRING CHARGE%'
            OR UPPER(sl.item_name) LIKE '%REPAIR CHARGE%'
          )
      )
      OR UPPER(qi.item_name) LIKE '%SERVICE%MAINTEN%'
      OR UPPER(qi.item_name) LIKE '%MAINTENECE%CHARGE%'
      OR UPPER(qi.item_name) LIKE '%REPARING CHARGE%'
    )
  )
`;

/** Installation / commissioning / related service spares on quotations. */
export const INSTALLATION_CHARGES_MATCH_SQL = `
  (
    NOT (${AMC_ITEM_MATCH_SQL})
    AND NOT (${MACHINE_REPAIR_SPARE_MATCH_SQL})
    AND (
      EXISTS (
        SELECT 1
        FROM spare_list sl
        WHERE (
            CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
            OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
          )
          AND (
            UPPER(sl.item_name) LIKE '%INSTALL%'
            OR UPPER(sl.item_name) LIKE '%COMMISSION%'
            OR UPPER(sl.item_name) LIKE '%TRANSPORTATION%CHARGE%'
            OR UPPER(sl.item_name) LIKE '%LOADING%UNLOAD%'
          )
      )
      OR UPPER(qi.item_name) LIKE '%INSTALL%CHARGE%'
      OR UPPER(qi.item_name) LIKE '%INSTALLATION%'
      OR UPPER(qi.item_name) LIKE '%COMMISSION%CHARGE%'
      OR UPPER(qi.item_name) LIKE '%COMMISSIONING%'
      OR UPPER(qi.item_name) LIKE '%TRANSPORTATION%CHARGE%'
    )
  )
`;

/** Freight / courier / porter etc. recovered on customer orders. */
export const FREIGHT_RECOVERED_MATCH_SQL = `
  (
    NOT (${AMC_ITEM_MATCH_SQL})
    AND NOT (${MACHINE_REPAIR_SPARE_MATCH_SQL})
    AND NOT (${INSTALLATION_CHARGES_MATCH_SQL})
    AND (
      EXISTS (
        SELECT 1
        FROM spare_list sl
        WHERE (
            CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
            OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
          )
          AND (
            UPPER(sl.item_name) LIKE '%FREIGHT%'
            OR UPPER(sl.item_name) LIKE '%COURIER%'
            OR UPPER(sl.item_name) LIKE '%PORTER%'
            OR UPPER(sl.item_name) LIKE '%DELIVERY%CHARGE%'
            OR UPPER(sl.item_name) LIKE '%FORWARDING%'
          )
      )
      OR UPPER(qi.item_name) LIKE '%FREIGHT%'
      OR UPPER(qi.item_name) LIKE '%COURIER%'
      OR UPPER(qi.item_name) LIKE '%PORTER%'
      OR UPPER(qi.item_name) LIKE '%DELIVERY%CHARGE%'
    )
  )
`;

/** Spare-parts sales: spare_list lines only (no machines/products from products_list). */
export const SPARE_PARTS_SALES_MATCH_SQL = `
  (
    EXISTS (
      SELECT 1
      FROM spare_list sl
      WHERE (
          CAST(sl.spare_number AS CHAR) = TRIM(qi.item_code)
          OR CAST(sl.id AS CHAR) = TRIM(qi.item_code)
        )
    )
    AND NOT (${PAT_PHYSICAL_PRODUCT_LINE_SQL})
    AND NOT (${AMC_ITEM_MATCH_SQL})
    AND NOT (${MACHINE_REPAIR_SPARE_MATCH_SQL})
    AND NOT (${INSTALLATION_CHARGES_MATCH_SQL})
    AND NOT (${FREIGHT_RECOVERED_MATCH_SQL})
  )
`;

const PAT_SECTION_ITEM_FILTER = {
  amc_service: AMC_ITEM_MATCH_SQL,
  machine_repair: MACHINE_REPAIR_SPARE_MATCH_SQL,
  spare_parts_sales: SPARE_PARTS_SALES_MATCH_SQL,
  installation_charges: INSTALLATION_CHARGES_MATCH_SQL,
  freight_recovered: FREIGHT_RECOVERED_MATCH_SQL,
};

/** SQL predicate for quotation_items `qi`, or null when all lines should be shown. */
export function patQuotationItemFilterSql(patSection) {
  const key = String(patSection ?? "").trim();
  if (!key || key === "revenue_sales") return null;
  return PAT_SECTION_ITEM_FILTER[key] ?? null;
}
