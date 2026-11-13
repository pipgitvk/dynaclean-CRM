function followupTimeMs(value) {
  if (!value) return NaN;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? NaN : t;
}

/**
 * Pick the most recent follow-up note for header search (TL vs employee).
 */
export function pickLatestHeaderFollowup({
  tl_notes,
  tl_followed_date,
  tl_created_at,
  employee_notes,
  employee_followed_date,
}) {
  const tlNote = String(tl_notes ?? "").trim();
  const empNote = String(employee_notes ?? "").trim();
  const tlWhen = tl_followed_date || tl_created_at || null;
  const empWhen = employee_followed_date || null;
  const tlT = followupTimeMs(tlWhen);
  const empT = followupTimeMs(empWhen);

  if (!tlNote && !empNote) {
    return { note: "", at: null, label: "Last follow-up:" };
  }
  if (tlNote && !empNote) {
    return { note: tlNote, at: tlWhen, label: "Last TL follow-up:" };
  }
  if (empNote && !tlNote) {
    return { note: empNote, at: empWhen, label: "Last follow-up:" };
  }

  if (!Number.isNaN(tlT) && !Number.isNaN(empT)) {
    if (tlT >= empT) {
      return { note: tlNote, at: tlWhen, label: "Last TL follow-up:" };
    }
    return { note: empNote, at: empWhen, label: "Last follow-up:" };
  }
  if (!Number.isNaN(tlT)) {
    return { note: tlNote, at: tlWhen, label: "Last TL follow-up:" };
  }
  if (!Number.isNaN(empT)) {
    return { note: empNote, at: empWhen, label: "Last follow-up:" };
  }

  return {
    note: empNote,
    at: empWhen || tlWhen,
    label: "Last follow-up:",
  };
}

function mapFirstRowPerCustomerId(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const id = row?.customer_id;
    if (id == null) continue;
    const key = String(id);
    if (!map.has(key)) map.set(key, row);
  }
  return map;
}

export async function latestEmployeeFollowupsByCustomerIds(conn, customerIds) {
  if (!customerIds?.length) return new Map();
  const placeholders = customerIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT cf.customer_id, cf.notes, cf.followed_date
     FROM customers_followup cf
     INNER JOIN (
       SELECT customer_id, MAX(followed_date) AS max_followed
       FROM customers_followup
       WHERE customer_id IN (${placeholders})
       GROUP BY customer_id
     ) latest
       ON cf.customer_id = latest.customer_id
       AND cf.followed_date = latest.max_followed
     ORDER BY cf.time_stamp DESC`,
    customerIds,
  );
  return mapFirstRowPerCustomerId(rows);
}

export async function latestTlFollowupsByCustomerIds(conn, customerIds) {
  if (!customerIds?.length) return new Map();
  const placeholders = customerIds.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT t.customer_id, t.notes, t.followed_date, t.created_at,
            t.next_followup_date, t.followed_by
     FROM TL_followups t
     INNER JOIN (
       SELECT customer_id, MAX(created_at) AS max_created
       FROM TL_followups
       WHERE customer_id IN (${placeholders})
       GROUP BY customer_id
     ) latest
       ON t.customer_id = latest.customer_id AND t.created_at = latest.max_created`,
    customerIds,
  );
  return mapFirstRowPerCustomerId(rows);
}

export function attachHeaderFollowupFields(customer, tlRow, empRow) {
  const picked = pickLatestHeaderFollowup({
    tl_notes: tlRow?.notes,
    tl_followed_date: tlRow?.followed_date,
    tl_created_at: tlRow?.created_at,
    employee_notes: empRow?.notes,
    employee_followed_date: empRow?.followed_date,
  });

  return {
    ...customer,
    latest_followup_notes: empRow?.notes ?? "",
    latest_followed_date: empRow?.followed_date ?? null,
    tl_notes: tlRow?.notes ?? "",
    tl_followed_date: tlRow?.followed_date ?? null,
    tl_created_at: tlRow?.created_at ?? null,
    last_followup_note: picked.note,
    last_followup_at: picked.at,
    last_followup_label: picked.label,
  };
}
