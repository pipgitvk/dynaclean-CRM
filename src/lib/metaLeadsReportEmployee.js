/**
 * Employee who received the lead (Assigned To), not who added/assigned it (assigned_to column).
 */
export const LEADS_REPORT_RECEIVER_SQL = `COALESCE(
  NULLIF(TRIM(c.lead_source), ''),
  NULLIF(TRIM(c.sales_representative), ''),
  'Unassigned'
)`;
