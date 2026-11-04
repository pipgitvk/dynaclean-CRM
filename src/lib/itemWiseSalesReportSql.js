/**
 * Item-wise sales report: approved orders only; cancelled / rejected / returned excluded.
 */

/** Same as order list stats — cancelled orders never appear in this report. */
export const ITEM_WISE_SALES_ORDER_ELIGIBILITY = `
  (n.is_cancelled = 0 OR n.is_cancelled IS NULL)
  AND LOWER(TRIM(COALESCE(n.approval_status, ''))) = 'approved'
  AND LOWER(TRIM(COALESCE(n.approval_status, ''))) <> 'rejected'
  AND COALESCE(n.is_returned, 0) NOT IN (1, 2, 3)
`;

/** Link order → quotation header (quote_number or quotation_id). */
export const ITEM_WISE_QUOTATION_RECORDS_JOIN = `
  LEFT JOIN quotations_records qr ON (
    (n.quotation_id IS NOT NULL AND n.quotation_id > 0 AND qr.\`S.No.\` = n.quotation_id)
    OR (
      TRIM(COALESCE(n.quote_number, '')) <> ''
      AND TRIM(qr.quote_number) = TRIM(n.quote_number)
    )
  )
`;

/** Line items for the resolved quote number (header match or order quote_number). */
export const ITEM_WISE_QUOTATION_ITEMS_JOIN = `
  INNER JOIN quotation_items qi ON TRIM(qi.quote_number) = TRIM(
    COALESCE(NULLIF(TRIM(qr.quote_number), ''), NULLIF(TRIM(n.quote_number), ''))
  )
`;

/** Shared FROM + WHERE for item-wise sales report rows (orders with line items). */
export const ITEM_WISE_SALES_REPORT_FROM_WHERE = `
  FROM neworder n
  ${ITEM_WISE_QUOTATION_RECORDS_JOIN}
  LEFT JOIN customers c ON qr.customer_id = c.customer_id
  ${ITEM_WISE_QUOTATION_ITEMS_JOIN}
  WHERE ${ITEM_WISE_SALES_ORDER_ELIGIBILITY}
    AND TRIM(COALESCE(NULLIF(TRIM(qr.quote_number), ''), NULLIF(TRIM(n.quote_number), ''))) <> ''
`;

/** Build date filter on n.created_at and push bound params (mutates params array). */
export function appendItemWiseSalesDateFilter(from, to, params) {
  if (from && to) {
    params.push(from, to);
    return "AND DATE(n.created_at) BETWEEN ? AND ?";
  }
  if (from) {
    params.push(from);
    return "AND DATE(n.created_at) >= ?";
  }
  return "";
}
