/** SQL fragments: orders included in monitor-target / employee-target achievement. */

export const NEWORDER_ACTIVE_FOR_TARGET_SQL = `
  AND (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
  AND LOWER(TRIM(COALESCE(no.approval_status, ''))) = 'approved'
`;
