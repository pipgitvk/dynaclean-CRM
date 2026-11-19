import {
  BULK_LEAD_REASSIGN_HISTORY_TABLE,
  ensureBulkLeadReassignHistoryTable,
} from "@/lib/bulkLeadReassignHistory";
import { REASSIGN_NO_FOLLOWUP_DAYS } from "@/lib/reassignNoFollowupConstants";
import { salesReassignHistoryScopeSql } from "@/lib/reassignSalesScope";

export { REASSIGN_NO_FOLLOWUP_DAYS };

const REASSIGN_EVENT_SOURCES = ["backfill", "live"];

function buildWhere(filters, params) {
  let sql = ` WHERE h.source IN (${REASSIGN_EVENT_SOURCES.map(() => "?").join(", ")})`;
  params.push(...REASSIGN_EVENT_SOURCES);
  sql += salesReassignHistoryScopeSql("h");

  if (filters.from) {
    sql += ` AND DATE(h.valid_from) >= ?`;
    params.push(filters.from);
  }
  if (filters.to) {
    sql += ` AND DATE(h.valid_from) <= ?`;
    params.push(filters.to);
  }
  if (filters.customerId) {
    sql += ` AND h.customer_id = ?`;
    params.push(Number(filters.customerId));
  }
  if (filters.assignedTo) {
    sql += ` AND TRIM(h.assigned_to) = TRIM(?)`;
    params.push(filters.assignedTo);
  }
  if (filters.assignedFrom) {
    sql += ` AND TRIM(h.assigned_from) = TRIM(?)`;
    params.push(filters.assignedFrom);
  }
  if (filters.assignedBy) {
    sql += ` AND TRIM(h.assigned_by) = TRIM(?)`;
    params.push(filters.assignedBy);
  }
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    sql += ` AND (
      CAST(h.customer_id AS CHAR) LIKE ?
      OR COALESCE(h.name, '') LIKE ?
      OR COALESCE(h.company_name, '') LIKE ?
      OR COALESCE(h.assigned_from, '') LIKE ?
      OR COALESCE(h.assigned_to, '') LIKE ?
      OR COALESCE(h.assigned_by, '') LIKE ?
      OR COALESCE(h.phone, '') LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  return sql;
}

export async function fetchReassignHistoryRepOptions(conn) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const [rows] = await conn.execute(
    `SELECT DISTINCT rep FROM (
       SELECT TRIM(h.assigned_from) AS rep
       FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
       WHERE h.source IN ('backfill', 'live')
         AND h.assigned_from IS NOT NULL AND TRIM(h.assigned_from) <> ''
         ${salesReassignHistoryScopeSql("h")}
       UNION
       SELECT TRIM(h.assigned_to) AS rep
       FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
       WHERE h.source IN ('backfill', 'live')
         AND h.assigned_to IS NOT NULL AND TRIM(h.assigned_to) <> ''
         ${salesReassignHistoryScopeSql("h")}
     ) u
     WHERE rep IS NOT NULL AND TRIM(rep) <> ''
     ORDER BY rep ASC`,
  );
  return rows.map((r) => String(r.rep).trim()).filter(Boolean);
}

export async function fetchReassignHistoryAssignedByOptions(conn) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const [rows] = await conn.execute(
    `SELECT DISTINCT TRIM(h.assigned_by) AS rep
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     WHERE h.source IN ('backfill', 'live')
       AND h.assigned_by IS NOT NULL AND TRIM(h.assigned_by) <> ''
       ${salesReassignHistoryScopeSql("h")}
     ORDER BY rep ASC`,
  );
  return rows.map((r) => String(r.rep).trim()).filter(Boolean);
}

/** Per assigned_from lead counts for a fixed assigned_to (same filters except assigned_from). */
export async function fetchReassignFromCountsForAssignedTo(conn, assignedTo, filters = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const to = String(assignedTo || "").trim();
  if (!to) return [];

  const params = [];
  const scopedFilters = {
    from: filters.from,
    to: filters.to,
    search: filters.search,
    assignedTo: to,
    assignedBy: filters.assignedBy,
    customerId: filters.customerId,
  };
  const where = buildWhere(scopedFilters, params);

  const [rows] = await conn.execute(
    `SELECT TRIM(h.assigned_from) AS rep, COUNT(*) AS cnt
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     ${where}
       AND h.assigned_from IS NOT NULL AND TRIM(h.assigned_from) <> ''
     GROUP BY TRIM(h.assigned_from)
     ORDER BY cnt DESC, rep ASC`,
    params,
  );

  return rows
    .map((r) => ({
      rep: String(r.rep || "").trim(),
      count: Number(r.cnt || 0),
    }))
    .filter((r) => r.rep && r.count > 0);
}

/** Per assigned_to lead counts for a fixed assigned_from (same filters except assigned_to). */
export async function fetchReassignToCountsForAssignedFrom(conn, assignedFrom, filters = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const fromRep = String(assignedFrom || "").trim();
  if (!fromRep) return [];

  const params = [];
  const scopedFilters = {
    from: filters.from,
    to: filters.to,
    search: filters.search,
    assignedFrom: fromRep,
    assignedBy: filters.assignedBy,
    customerId: filters.customerId,
  };
  const where = buildWhere(scopedFilters, params);

  const [rows] = await conn.execute(
    `SELECT TRIM(h.assigned_to) AS rep, COUNT(*) AS cnt
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     ${where}
       AND h.assigned_to IS NOT NULL AND TRIM(h.assigned_to) <> ''
     GROUP BY TRIM(h.assigned_to)
     ORDER BY cnt DESC, rep ASC`,
    params,
  );

  return rows
    .map((r) => ({
      rep: String(r.rep || "").trim(),
      count: Number(r.cnt || 0),
    }))
    .filter((r) => r.rep && r.count > 0);
}

export async function countLeadReassignEvents(conn, filters = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const params = [];
  const where = buildWhere(filters, params);
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS total FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h${where}`,
    params,
  );
  return Number(row?.total || 0);
}

export async function fetchLeadReassignHistoryPage(conn, filters = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 500);
  const skip = Math.max(Number(filters.skip) || 0, 0);

  const params = [];
  const where = buildWhere(filters, params);

  const total = await countLeadReassignEvents(conn, filters);

  const [rows] = await conn.execute(
    `SELECT
       h.id,
       h.customer_id,
       h.name,
       h.company_name,
       h.assigned_from,
       h.assigned_to,
       h.assigned_by,
       h.valid_from,
       h.valid_to,
       (
         SELECT MAX(cf.time_stamp)
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_from, ''))
           AND cf.time_stamp < h.valid_from
           AND cf.time_stamp > '1999-12-31'
       ) AS last_followup_assigned_from,
       (
         SELECT cf.notes
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_from, ''))
           AND cf.time_stamp < h.valid_from
           AND cf.time_stamp > '1999-12-31'
         ORDER BY cf.time_stamp DESC
         LIMIT 1
       ) AS last_followup_assigned_from_notes,
       (
         SELECT MAX(cf.time_stamp)
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_to, ''))
           AND cf.time_stamp >= h.valid_from
           AND (h.valid_to IS NULL OR cf.time_stamp <= h.valid_to)
           AND cf.time_stamp > '1999-12-31'
       ) AS last_followup_assigned_to,
       (
         SELECT cf.notes
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_to, ''))
           AND cf.time_stamp >= h.valid_from
           AND (h.valid_to IS NULL OR cf.time_stamp <= h.valid_to)
           AND cf.time_stamp > '1999-12-31'
         ORDER BY cf.time_stamp DESC
         LIMIT 1
       ) AS last_followup_assigned_to_notes
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     ${where}
     ORDER BY h.valid_from DESC, h.id DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, skip],
  );

  return { total, data: rows, limit, skip };
}

const ASSIGN_TO_FOLLOWUP_EXISTS_SQL = `
  EXISTS (
    SELECT 1 FROM customers_followup cf
    WHERE cf.customer_id = h.customer_id
      AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(h.assigned_to)
      AND cf.time_stamp >= h.valid_from
      AND (h.valid_to IS NULL OR cf.time_stamp <= h.valid_to)
      AND cf.time_stamp > '1999-12-31'
  )`;

/** @param {'followed' | 'not_followed' | null | undefined} followupStatus */
function buildReassignFollowupCohortWhere(filters, params, followupStatus) {
  let sql = ` WHERE h.source IN (${REASSIGN_EVENT_SOURCES.map(() => "?").join(", ")})`;
  params.push(...REASSIGN_EVENT_SOURCES);
  sql += salesReassignHistoryScopeSql("h");

  sql += `
    AND h.valid_from <= DATE_SUB(NOW(), INTERVAL ${REASSIGN_NO_FOLLOWUP_DAYS} DAY)
    AND h.valid_from > '1999-12-31'
    AND EXISTS (
      SELECT 1 FROM customers c
      WHERE c.customer_id = h.customer_id
        AND TRIM(COALESCE(c.lead_source, '')) = TRIM(h.assigned_to)
        AND TRIM(COALESCE(c.lead_source, '')) <> ''
    )
    AND h.id = (
      SELECT h2.id
      FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h2
      WHERE h2.customer_id = h.customer_id
        AND h2.source IN (${REASSIGN_EVENT_SOURCES.map(() => "?").join(", ")})
        ${salesReassignHistoryScopeSql("h2")}
      ORDER BY h2.valid_from DESC, h2.id DESC
      LIMIT 1
    )`;
  params.push(...REASSIGN_EVENT_SOURCES);

  if (followupStatus === "not_followed") {
    sql += ` AND NOT ${ASSIGN_TO_FOLLOWUP_EXISTS_SQL}`;
  } else if (followupStatus === "followed") {
    sql += ` AND ${ASSIGN_TO_FOLLOWUP_EXISTS_SQL}`;
  }

  if (filters.assignedTo) {
    sql += ` AND TRIM(h.assigned_to) = TRIM(?)`;
    params.push(filters.assignedTo);
  }
  if (filters.assignedFrom) {
    sql += ` AND TRIM(h.assigned_from) = TRIM(?)`;
    params.push(filters.assignedFrom);
  }
  if (filters.search) {
    const term = `%${String(filters.search).trim()}%`;
    sql += ` AND (
      CAST(h.customer_id AS CHAR) LIKE ?
      OR COALESCE(h.name, '') LIKE ?
      OR COALESCE(h.company_name, '') LIKE ?
      OR COALESCE(h.assigned_from, '') LIKE ?
      OR COALESCE(h.assigned_to, '') LIKE ?
      OR COALESCE(h.assigned_by, '') LIKE ?
      OR COALESCE(h.phone, '') LIKE ?
    )`;
    params.push(term, term, term, term, term, term, term);
  }

  return sql;
}

function resolveFollowupStatusFilter(filters) {
  const v = String(filters.followupStatus || "").trim().toLowerCase();
  if (v === "followed" || v === "not_followed") return v;
  return undefined;
}

export async function countReassignFollowupCohort(conn, filters = {}, followupStatus) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const params = [];
  const where = buildReassignFollowupCohortWhere(filters, params, followupStatus);
  const [[row]] = await conn.execute(
    `SELECT COUNT(*) AS total FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h${where}`,
    params,
  );
  return Number(row?.total || 0);
}

export async function fetchReassignFollowupSummary(conn, filters = {}) {
  const [followed, notFollowed] = await Promise.all([
    countReassignFollowupCohort(conn, filters, "followed"),
    countReassignFollowupCohort(conn, filters, "not_followed"),
  ]);
  return { followed, not_followed: notFollowed };
}

export async function countReassignNoFollowupLeads(conn, filters = {}) {
  return countReassignFollowupCohort(conn, filters, "not_followed");
}

export async function fetchReassignNoFollowupRepOptions(conn) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const params = [];
  const where = buildReassignFollowupCohortWhere({}, params, undefined);
  const [rows] = await conn.execute(
    `SELECT DISTINCT TRIM(h.assigned_to) AS rep
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h${where}
       AND h.assigned_to IS NOT NULL AND TRIM(h.assigned_to) <> ''
     ORDER BY rep ASC`,
    params,
  );
  return rows.map((r) => String(r.rep).trim()).filter(Boolean);
}

export async function fetchReassignNoFollowupPage(conn, filters = {}) {
  await ensureBulkLeadReassignHistoryTable(conn);
  const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 500);
  const skip = Math.max(Number(filters.skip) || 0, 0);
  const followupStatus = resolveFollowupStatusFilter(filters);

  const params = [];
  const where = buildReassignFollowupCohortWhere(filters, params, followupStatus);
  const total = await countReassignFollowupCohort(conn, filters, followupStatus);

  const [rows] = await conn.execute(
    `SELECT
       h.id,
       h.customer_id,
       h.name,
       h.company_name,
       h.phone,
       h.assigned_from,
       h.assigned_to,
       h.assigned_by,
       h.valid_from,
       DATEDIFF(NOW(), h.valid_from) AS days_since_reassign,
       (
         SELECT MAX(cf.time_stamp)
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_from, ''))
           AND cf.time_stamp < h.valid_from
           AND cf.time_stamp > '1999-12-31'
       ) AS last_followup_assigned_from,
       (
         SELECT cf.notes
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(COALESCE(h.assigned_from, ''))
           AND cf.time_stamp < h.valid_from
           AND cf.time_stamp > '1999-12-31'
         ORDER BY cf.time_stamp DESC
         LIMIT 1
       ) AS last_followup_assigned_from_notes,
       (
         SELECT MAX(cf.time_stamp)
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(h.assigned_to)
           AND cf.time_stamp >= h.valid_from
           AND (h.valid_to IS NULL OR cf.time_stamp <= h.valid_to)
           AND cf.time_stamp > '1999-12-31'
       ) AS last_followup_assigned_to,
       (
         SELECT cf.notes
         FROM customers_followup cf
         WHERE cf.customer_id = h.customer_id
           AND TRIM(COALESCE(cf.followed_by, '')) = TRIM(h.assigned_to)
           AND cf.time_stamp >= h.valid_from
           AND (h.valid_to IS NULL OR cf.time_stamp <= h.valid_to)
           AND cf.time_stamp > '1999-12-31'
         ORDER BY cf.time_stamp DESC
         LIMIT 1
       ) AS last_followup_assigned_to_notes
     FROM ${BULK_LEAD_REASSIGN_HISTORY_TABLE} h
     ${where}
     ORDER BY h.valid_from ASC, h.id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, skip],
  );

  const data = rows.map((row) => ({
    ...row,
    followup_status: row.last_followup_assigned_to ? "followed" : "not_followed",
  }));

  return { total, data, limit, skip };
}