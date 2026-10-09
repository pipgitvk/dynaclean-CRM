import { isSalesRole } from "@/lib/isSalesRole";
import { sqlServiceSupportFollowedByScope } from "@/lib/serviceSupportTeamScope";

export function collectHierarchyCustomerIds({
  customerId,
  parentContact = null,
  siblingContacts = [],
  childContacts = [],
}) {
  const ids = new Set();
  const add = (id) => {
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) ids.add(n);
  };

  add(customerId);
  add(parentContact?.customer_id);
  for (const contact of siblingContacts || []) add(contact?.customer_id);
  for (const contact of childContacts || []) add(contact?.customer_id);

  return [...ids];
}

export async function fetchCustomerFollowupHistory(
  conn,
  { customerIds, userRole = "", username = "" },
) {
  const ids = [...new Set(customerIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const includeContactLabel = ids.length > 1;
  const selectFields = includeContactLabel
    ? `cf.next_followup_date, cf.service_next_followup, cf.gem_next_followup,
       cf.followed_date, cf.followed_by, cf.notes, cf.comm_mode, cf.time_stamp,
       cf.multi_tag,
       cf.customer_id,
       TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS contact_name`
    : `cf.next_followup_date, cf.service_next_followup, cf.gem_next_followup,
       cf.followed_date, cf.followed_by, cf.notes, cf.comm_mode, cf.time_stamp,
       cf.multi_tag`;

  let sql = `SELECT ${selectFields}
     FROM customers_followup cf`;
  if (includeContactLabel) {
    sql += " LEFT JOIN customers c ON c.customer_id = cf.customer_id";
  }
  sql += ` WHERE cf.customer_id IN (${placeholders})`;

  const params = [...ids];

  if (userRole === "SERVICE SUPPORT") {
    sql += ` AND ${sqlServiceSupportFollowedByScope()}`;
  } else if (userRole === "TEAM LEADER" || userRole === "ACCOUNTANT") {
    sql += " AND cf.followed_by = ?";
    params.push(username);
  } else if (isSalesRole(userRole)) {
    sql += ` AND (
      cf.followed_by IS NULL
      OR cf.followed_by = ''
      OR NOT EXISTS (
        SELECT 1
        FROM rep_list rl
        WHERE rl.username = cf.followed_by
          AND UPPER(TRIM(rl.userRole)) = 'SERVICE SUPPORT'
      )
    )`;
  }

  sql += " ORDER BY cf.time_stamp DESC";

  const [rows] = await conn.execute(sql, params);

  return (rows || []).map((row) => {
    if (!includeContactLabel) return row;
    const contactName = String(row.contact_name || "").trim();
    return {
      ...row,
      contact_name: contactName || `Customer ${row.customer_id}`,
    };
  });
}
