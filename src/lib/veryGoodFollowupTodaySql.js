import { getTodayYmdIST } from "@/lib/prospectCommitmentRules";
import { mysqlBoundsForIstDateRange } from "@/lib/timezone";

export function getVeryGoodFollowupTodayBounds() {
  const today = getTodayYmdIST();
  return mysqlBoundsForIstDateRange(today, today);
}

/**
 * Customers with status "Very Good" who had a follow-up today (IST).
 * When restrictToFollowedBy is set, only follow-ups logged by that user count.
 */
export function appendVeryGoodFollowupTodayFilter({
  conditions,
  params,
  customerAlias = "c",
  restrictToFollowedBy = null,
}) {
  const bounds = getVeryGoodFollowupTodayBounds();
  if (!bounds) return;

  const followedByClause = restrictToFollowedBy
    ? "AND cf_vgt.followed_by = ?"
    : "";

  conditions.push(`EXISTS (
    SELECT 1
    FROM customers_followup cf_vgt
    WHERE cf_vgt.customer_id = ${customerAlias}.customer_id
      AND ${customerAlias}.status = 'Very Good'
      AND cf_vgt.followed_date >= ?
      AND cf_vgt.followed_date <= ?
      ${followedByClause}
  )`);
  params.push(bounds.start, bounds.end);
  if (restrictToFollowedBy) {
    params.push(restrictToFollowedBy);
  }
}

export async function countVeryGoodFollowupsToday(conn, username, isSalesCumBackoffice) {
  const bounds = getVeryGoodFollowupTodayBounds();
  if (!bounds) return 0;

  let query = `
    SELECT COUNT(DISTINCT cf.customer_id) AS count
    FROM customers_followup cf
    INNER JOIN customers c ON c.customer_id = cf.customer_id
    WHERE c.status = 'Very Good'
      AND cf.followed_date >= ?
      AND cf.followed_date <= ?
  `;
  const queryParams = [bounds.start, bounds.end];

  if (!isSalesCumBackoffice) {
    query += " AND cf.followed_by = ?";
    queryParams.push(username);
  }

  const [rows] = await conn.execute(query, queryParams);
  return Number(rows[0]?.count || 0);
}
