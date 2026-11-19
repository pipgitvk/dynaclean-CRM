export const BULK_LEAD_REASSIGN_HISTORY_TABLE = "bulk_lead_reassign_history";

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS ${BULK_LEAD_REASSIGN_HISTORY_TABLE} (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id INT NOT NULL,
    name VARCHAR(255) NULL,
    company_name VARCHAR(255) NULL,
    address TEXT NULL,
    phone VARCHAR(50) NULL,
    lead_source VARCHAR(100) NULL,
    assigned_to VARCHAR(100) NOT NULL,
    assigned_from VARCHAR(100) NULL,
    assigned_by VARCHAR(100) NOT NULL DEFAULT 'admin',
    lead_type ENUM('sales', 'service', 'gem') NOT NULL DEFAULT 'sales',
    valid_from DATETIME NOT NULL,
    valid_to DATETIME NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'live',
    followup_time_stamp DATETIME NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_blrh_customer (customer_id),
    KEY idx_blrh_assigned_to (assigned_to),
    KEY idx_blrh_valid (customer_id, valid_from),
    UNIQUE KEY uniq_blrh_followup_event (customer_id, lead_type, followup_time_stamp, assigned_to, valid_from)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

function normalizeRepName(value) {
  const t = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t === "—" || t === "-" || t.toLowerCase() === "null") return null;
  return t;
}

export function parseReassignNote(notes) {
  const s = String(notes || "").replace(/\s+/g, " ").trim();
  if (!s) return null;

  const patterns = [
    {
      leadType: "sales",
      prefix: "re-assigned lead from ",
      label: "sales",
    },
    {
      leadType: "service",
      prefix: "service lead source changed from ",
      label: "service",
    },
    {
      leadType: "gem",
      prefix: "gem lead source changed from ",
      label: "gem",
    },
  ];

  const lower = s.toLowerCase();
  for (const { leadType, prefix } of patterns) {
    if (!lower.startsWith(prefix)) continue;

    const rest = s.slice(prefix.length);
    const toIdx = rest.toLowerCase().indexOf(" to ");
    if (toIdx < 0) continue;

    const assignedFrom = normalizeRepName(rest.slice(0, toIdx));
    let tail = rest.slice(toIdx + 4).trim();
    let assignedBy = null;

    const byMatch = tail.match(/\s+by\s+(.+)$/i);
    if (byMatch) {
      assignedBy = normalizeRepName(byMatch[1]);
      tail = tail.slice(0, byMatch.index).trim();
    }

    const assignedTo = normalizeRepName(tail);
    if (!assignedTo) continue;

    return { leadType, assignedFrom, assignedTo, assignedBy };
  }

  return null;
}

export function customerSnapshotFields(customer) {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ").trim() || null;
  return {
    name,
    company_name: customer?.company ? String(customer.company).trim() : null,
    address: customer?.address ? String(customer.address).trim() : null,
    phone: customer?.phone ? String(customer.phone).trim() : null,
  };
}

/** Reject MySQL zero dates and invalid legacy `customers.date_created` values. */
export function isValidMysqlDateTime(value) {
  if (value == null || value === "") return false;
  const s = String(value).trim();
  if (s.startsWith("0000-00-00")) return false;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCFullYear() >= 2000;
}

/** First stint start: prefer earliest follow-up `time_stamp` (user rule), then date_created. */
export function resolveCustomerStartDate(dateCreated, earliestFollowupAt, firstReassignAt) {
  if (isValidMysqlDateTime(earliestFollowupAt)) return earliestFollowupAt;
  if (isValidMysqlDateTime(dateCreated)) return dateCreated;
  if (isValidMysqlDateTime(firstReassignAt)) return firstReassignAt;
  return null;
}

export function coalesceValidFrom(validFrom, ...fallbacks) {
  if (isValidMysqlDateTime(validFrom)) return validFrom;
  for (const f of fallbacks) {
    if (isValidMysqlDateTime(f)) return f;
  }
  return null;
}

async function fetchEarliestFollowupAt(conn, customerId) {
  const [[row]] = await conn.execute(
    `SELECT MIN(cf.time_stamp) AS earliest_at
     FROM customers_followup cf
     WHERE cf.customer_id = ?
       AND cf.time_stamp IS NOT NULL
       AND cf.time_stamp > '1999-12-31 23:59:59'
       AND cf.time_stamp NOT LIKE '0000%'`,
    [customerId],
  );
  const t = row?.earliest_at;
  return isValidMysqlDateTime(t) ? t : null;
}

/** Fix rows already stored with MySQL zero dates as valid_from. */
export async function repairZeroValidFromInHistory(conn) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const [result] = await conn.execute(
    `UPDATE ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     INNER JOIN (
       SELECT customer_id, MIN(time_stamp) AS earliest_ts
       FROM customers_followup
       WHERE time_stamp IS NOT NULL
         AND time_stamp > '1999-12-31 23:59:59'
         AND time_stamp NOT LIKE '0000%'
       GROUP BY customer_id
     ) cf ON cf.customer_id = h.customer_id
     SET h.valid_from = cf.earliest_ts
     WHERE h.valid_from IS NULL
        OR h.valid_from <= '1999-12-31 23:59:59'
        OR CAST(h.valid_from AS CHAR) LIKE '0000%'`,
  );
  return Number(result?.affectedRows || 0);
}

async function ensureBulkLeadReassignHistoryColumns(conn) {
  const [cols] = await conn.execute(`SHOW COLUMNS FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE}`);
  const names = new Set(cols.map((c) => c.Field));
  const alters = [];
  if (!names.has("followup_time_stamp")) {
    alters.push("ADD COLUMN followup_time_stamp DATETIME NULL AFTER source");
  }
  if (!names.has("source")) {
    alters.push("ADD COLUMN source VARCHAR(32) NOT NULL DEFAULT 'live' AFTER valid_to");
  }
  if (!names.has("valid_to")) {
    alters.push("ADD COLUMN valid_to DATETIME NULL AFTER valid_from");
  }
  if (!names.has("valid_from")) {
    alters.push("ADD COLUMN valid_from DATETIME NOT NULL AFTER lead_type");
  }
  if (!names.has("lead_type")) {
    alters.push(
      "ADD COLUMN lead_type ENUM('sales','service','gem') NOT NULL DEFAULT 'sales' AFTER assigned_by",
    );
  }
  if (alters.length) {
    await conn.execute(`ALTER TABLE ${BULK_LEAD_REASSIGN_HISTORY_TABLE} ${alters.join(", ")}`);
  }

  try {
    await conn.execute(
      `ALTER TABLE ${BULK_LEAD_REASSIGN_HISTORY_TABLE}
       ADD UNIQUE KEY uniq_blrh_followup_event (customer_id, lead_type, followup_time_stamp, assigned_to, valid_from)`,
    );
  } catch {
    /* index may already exist */
  }
}

export async function ensureBulkLeadReassignHistoryTable(conn) {
  await conn.execute(CREATE_TABLE_SQL);
  try {
    await ensureBulkLeadReassignHistoryColumns(conn);
  } catch (err) {
    if (err?.code !== "ER_NO_SUCH_TABLE") throw err;
  }
}

async function closeOpenStint(conn, { customerId, leadType, validTo }) {
  await conn.execute(
    `UPDATE ${BULK_LEAD_REASSIGN_HISTORY_TABLE}
     SET valid_to = ?
     WHERE customer_id = ? AND lead_type = ? AND valid_to IS NULL`,
    [validTo, customerId, leadType],
  );
}

async function insertStintRow(
  conn,
  {
    customerId,
    snapshot,
    leadType,
    assignedTo,
    assignedFrom,
    assignedBy,
    validFrom,
    validTo,
    source,
    followupTimeStamp,
  },
) {
  const assignedByValue = assignedBy || "admin";
  const safeValidFrom = coalesceValidFrom(validFrom, followupTimeStamp) || validFrom;
  const safeValidTo =
    validTo == null || validTo === ""
      ? null
      : coalesceValidFrom(validTo, safeValidFrom) || validTo;

  await conn.execute(
    `INSERT INTO ${BULK_LEAD_REASSIGN_HISTORY_TABLE}
     (customer_id, name, company_name, address, phone, lead_source,
      assigned_to, assigned_from, assigned_by, lead_type,
      valid_from, valid_to, source, followup_time_stamp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [
      customerId,
      snapshot.name,
      snapshot.company_name,
      snapshot.address,
      snapshot.phone,
      assignedTo,
      assignedTo,
      assignedFrom,
      assignedByValue,
      leadType,
      safeValidFrom,
      safeValidTo,
      source,
      followupTimeStamp,
    ],
  );
}

/** Record ownership stint when a lead is reassigned (live bulk/single flow). */
export async function recordLeadReassignHistory(
  conn,
  {
    customer,
    leadType,
    assignedFrom,
    assignedTo,
    assignedBy,
    validFrom,
    source = "live",
    followupTimeStamp = null,
    includePriorStint = false,
  },
) {
  await ensureBulkLeadReassignHistoryTable(conn);

  const customerId = Number(customer.customer_id);
  const snapshot = customerSnapshotFields(customer);
  const at = validFrom || new Date();
  const by = assignedBy || "admin";

  const [[{ open_count }]] = await conn.execute(
    `SELECT COUNT(*) AS open_count FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE}
     WHERE customer_id = ? AND lead_type = ? AND valid_to IS NULL`,
    [customerId, leadType],
  );

  if (includePriorStint && Number(open_count) === 0 && assignedFrom) {
    const fromDate = resolveCustomerStartDate(customer.date_created, null, at) || at;
    await insertStintRow(conn, {
      customerId,
      snapshot,
      leadType,
      assignedTo: assignedFrom,
      assignedFrom: null,
      assignedBy: "admin",
      validFrom: fromDate,
      validTo: at,
      source: `${source}_prior`,
      followupTimeStamp: null,
    });
  } else if (Number(open_count) > 0) {
    await closeOpenStint(conn, { customerId, leadType, validTo: at });
  }

  await insertStintRow(conn, {
    customerId,
    snapshot,
    leadType,
    assignedTo,
    assignedFrom,
    assignedBy: by,
    validFrom: at,
    validTo: null,
    source,
    followupTimeStamp,
  });
}

const BACKFILL_FOLLOWUP_SQL = `
  SELECT cf.customer_id, cf.time_stamp, cf.notes, cf.followed_by
  FROM customers_followup cf
  WHERE LOWER(TRIM(COALESCE(cf.comm_mode, ''))) = 'system'
    AND (
      cf.notes LIKE 'Re-assigned lead from%'
      OR cf.notes LIKE 're-assigned lead from%'
      OR cf.notes LIKE 'Service lead source changed%'
      OR cf.notes LIKE 'GEM lead source changed%'
    )
  ORDER BY cf.customer_id ASC, cf.time_stamp ASC
`;

/**
 * Rebuild stint rows from customers_followup system notes.
 * @returns {{ customersProcessed, eventsParsed, rowsInserted, skipped }}
 */
export async function backfillBulkLeadReassignHistory(conn, { resetBackfill = true } = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);

  if (resetBackfill) {
    await conn.execute(
      `DELETE FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} WHERE source LIKE 'backfill%'`,
    );
  }

  const [events] = await conn.execute(BACKFILL_FOLLOWUP_SQL);
  const byCustomer = new Map();
  for (const row of events) {
    const id = Number(row.customer_id);
    if (!byCustomer.has(id)) byCustomer.set(id, []);
    byCustomer.get(id).push(row);
  }

  let customersProcessed = 0;
  let eventsParsed = 0;
  let rowsInserted = 0;
  let skipped = 0;

  for (const [customerId, custEvents] of byCustomer) {
    const [custRows] = await conn.execute(
      `SELECT customer_id, first_name, last_name, company, address, phone, date_created
       FROM customers WHERE customer_id = ?`,
      [customerId],
    );
    if (!custRows.length) {
      skipped += custEvents.length;
      continue;
    }
    const customer = custRows[0];
    const snapshot = customerSnapshotFields(customer);
    const earliestFollowupAt = await fetchEarliestFollowupAt(conn, customerId);

    const parsedEvents = [];
    for (const ev of custEvents) {
      const parsed = parseReassignNote(ev.notes);
      if (!parsed) {
        skipped += 1;
        continue;
      }
      parsedEvents.push({
        ...parsed,
        time_stamp: ev.time_stamp,
        followed_by: ev.followed_by,
      });
      eventsParsed += 1;
    }

    if (!parsedEvents.length) continue;

    const byType = { sales: [], service: [], gem: [] };
    for (const pe of parsedEvents) {
      byType[pe.leadType].push(pe);
    }

    for (const leadType of ["sales", "service", "gem"]) {
      const list = byType[leadType];
      if (!list.length) continue;

      const first = list[0];
      const stintStart = resolveCustomerStartDate(
        customer.date_created,
        earliestFollowupAt,
        first.time_stamp,
      );
      if (
        first.assignedFrom &&
        stintStart &&
        new Date(stintStart).getTime() < new Date(first.time_stamp).getTime()
      ) {
        await insertStintRow(conn, {
          customerId,
          snapshot,
          leadType,
          assignedTo: first.assignedFrom,
          assignedFrom: null,
          assignedBy: "admin",
          validFrom: stintStart,
          validTo: first.time_stamp,
          source: "backfill_prior",
          followupTimeStamp: null,
        });
        rowsInserted += 1;
      }

      for (let i = 0; i < list.length; i++) {
        const ev = list[i];
        const nextTs = list[i + 1]?.time_stamp ?? null;
        const assignedBy = ev.assignedBy || ev.followed_by || "admin";
        await insertStintRow(conn, {
          customerId,
          snapshot,
          leadType,
          assignedTo: ev.assignedTo,
          assignedFrom: ev.assignedFrom,
          assignedBy,
          validFrom: ev.time_stamp,
          validTo: nextTs,
          source: "backfill",
          followupTimeStamp: ev.time_stamp,
        });
        rowsInserted += 1;
      }
    }

    customersProcessed += 1;
  }

  const repairedZeroDates = await repairZeroValidFromInHistory(conn);

  return { customersProcessed, eventsParsed, rowsInserted, skipped, repairedZeroDates };
}