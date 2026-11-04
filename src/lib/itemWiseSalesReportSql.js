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
