/** Bulk reassign KPIs / lists: only sales-team reps (rep_list.userRole = SALES). */
export function salesReassignHistoryScopeSql(alias = "h") {
  return `
    AND ${alias}.lead_type = 'sales'
    AND EXISTS (
      SELECT 1 FROM rep_list r_to
      WHERE r_to.username COLLATE utf8mb4_unicode_ci = TRIM(${alias}.assigned_to) COLLATE utf8mb4_unicode_ci
        AND UPPER(TRIM(r_to.userRole)) = 'SALES'
    )
    AND (
      ${alias}.assigned_from IS NULL OR TRIM(${alias}.assigned_from) = ''
      OR EXISTS (
        SELECT 1 FROM rep_list r_from
        WHERE r_from.username COLLATE utf8mb4_unicode_ci = TRIM(${alias}.assigned_from) COLLATE utf8mb4_unicode_ci
          AND UPPER(TRIM(r_from.userRole)) = 'SALES'
      )
    )`;
}

export const REP_LIST_IS_SALES_ROLE = `UPPER(TRIM(r.userRole)) = 'SALES'`;