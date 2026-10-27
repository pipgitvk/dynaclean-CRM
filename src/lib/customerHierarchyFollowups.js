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

/** TL_followups rows shaped like customers_followup for FollowUpHistory. */
export async function fetchCustomerTLFollowupHistory(conn, { customerIds }) {
  const ids = [...new Set(customerIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))];
  if (!ids.length) return [];

  const placeholders = ids.map(() => "?").join(", ");
  const includeContactLabel = ids.length > 1;
  const selectFields = includeContactLabel
    ? `tlf.next_followup_date, tlf.followed_date, tlf.followed_by, tlf.notes,
       tlf.multi_tag, tlf.created_at, tlf.customer_id,
       TRIM(CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, ''))) AS contact_name`
    : `tlf.next_followup_date, tlf.followed_date, tlf.followed_by, tlf.notes,
       tlf.multi_tag, tlf.created_at, tlf.customer_id`;

  let sql = `SELECT ${selectFields}
     FROM TL_followups tlf`;
  if (includeContactLabel) {
    sql += " LEFT JOIN customers c ON c.customer_id = tlf.customer_id";
  }
  sql += ` WHERE tlf.customer_id IN (${placeholders})
     ORDER BY tlf.created_at DESC`;

  const [rows] = await conn.execute(sql, ids);

  return (rows || []).map((row) => {
    const base = {
      next_followup_date: row.next_followup_date,
      service_next_followup: null,
      gem_next_followup: null,
      followed_date: row.followed_date,
      followed_by: row.followed_by,
      notes: row.notes,
      comm_mode: "TL",
      time_stamp: row.created_at || row.followed_date,
      multi_tag: row.multi_tag,
      customer_id: row.customer_id,
      followup_source: "TL",
    };
    if (!includeContactLabel) return base;
    const contactName = String(row.contact_name || "").trim();
    return {
      ...base,
      contact_name: contactName || `Customer ${row.customer_id}`,
    };
  });
}

export function mergeFollowupHistories(employeeRows = [], tlRows = []) {
  const merged = [...(employeeRows || []), ...(tlRows || [])];
  merged.sort(
    (a, b) =>
      new Date(b.time_stamp || b.followed_date || 0).getTime() -
      new Date(a.time_stamp || a.followed_date || 0).getTime(),
  );
  return merged;
}
