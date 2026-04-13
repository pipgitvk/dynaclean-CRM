import { TAMIL_META_ASSIGNEE_USERNAME } from "@/lib/metaTamilLeadForm";

/**
 * Tamil leads must go to one CRM user (default KAVYA).
 * 1) Active row in lead_distribution (case-insensitive username)
 * 2) Else active employee in rep_list (case-insensitive)
 * 3) Else literal preferred string (still saves lead; no lead_distribution row needed)
 */
export async function resolveTamilAssigneeUsername(conn, preferred = TAMIL_META_ASSIGNEE_USERNAME) {
  const label = String(preferred ?? TAMIL_META_ASSIGNEE_USERNAME).trim();
  const [ld] = await conn.execute(
    `SELECT username FROM lead_distribution WHERE is_active = 1 AND UPPER(TRIM(username)) = UPPER(?) LIMIT 1`,
    [label],
  );
  if (ld.length) {
    return { username: ld[0].username, incrementLeadDistribution: true };
  }
  const [rep] = await conn.execute(
    `SELECT username FROM rep_list WHERE UPPER(TRIM(username)) = UPPER(?) LIMIT 1`,
    [label],
  );
  if (rep.length) {
    return { username: rep[0].username, incrementLeadDistribution: false };
  }
  return { username: label, incrementLeadDistribution: false };
}
