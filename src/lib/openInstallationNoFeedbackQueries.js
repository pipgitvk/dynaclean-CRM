import { getDbConnection } from "@/lib/db";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  sqlTrimUtf8EqColumns,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { enrichOpenInstallationRowsWithServices } from "@/lib/openInstallationServiceEnrich";
import {
  countOpenInstallationGoogleFeedbackStats,
  fetchOpenInstallationGoogleFeedbackPage,
} from "@/lib/openInstallationGoogleFeedbackQueries";

const COUNT_CACHE = new Map();
const COUNT_TTL_MS = 90_000;

/** Global set of quote keys that already have an installation report. */
let REPORT_QUOTE_CACHE = { at: 0, keys: null };
const REPORT_QUOTE_TTL_MS = 180_000;

/** Same cheap neworder gate as Installation Completed card. */
function buildInstalledOrderWhereSql(filters) {
  const f = parseSbiFilters(filters);
  let sql = `
    WHERE (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
      AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
      AND COALESCE(no.installation_status, 0) = 1
  `;
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      no.order_id LIKE ? OR no.quote_number LIKE ? OR no.company_name LIKE ?
      OR no.contact LIKE ? OR no.invoice_number LIKE ? OR no.delivery_location LIKE ?
      OR no.state LIKE ? OR no.created_by LIKE ?
    )`;
    params.push(...Array(8).fill(term));
  }
  if (f.state) {
    sql += ` AND no.state LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND (no.invoice_number LIKE ? OR no.order_id LIKE ? OR no.quote_number LIKE ?)`;
    params.push(`%${f.serial}%`, `%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(no.delivery_date) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(no.delivery_date) <= ?`;
    params.push(f.to);
  }
  if (f.salesPerson) {
    sql += ` AND TRIM(no.created_by) = TRIM(?)`;
    params.push(f.salesPerson);
  }
  if (f.assignedBy) {
    sql += ` AND EXISTS (
      SELECT 1
      FROM dispatch d_ab
      INNER JOIN service_records sr_ab
        ON ${sqlTrimUtf8EqColumns("sr_ab.serial_number", "d_ab.serial_no")}
      WHERE ${sqlTrimUtf8EqColumns("d_ab.quote_number", "no.quote_number")}
        AND UPPER(TRIM(COALESCE(sr_ab.service_type, ''))) = 'INSTALLATION'
        AND TRIM(sr_ab.engineer_assigned_by) = TRIM(?)
    )`;
    params.push(f.assignedBy);
  }
  return { sql, params };
}

function countCacheKey(filters) {
  const f = parseSbiFilters(filters);
  return JSON.stringify({
    search: f.search,
    state: f.state,
    serial: f.serial,
    from: f.from,
    to: f.to,
    salesPerson: f.salesPerson,
    assignedBy: f.assignedBy,
  });
}

/**
 * Quotes that have any non-empty INSTALLATION installation_report.
 * Starts from service_records with a report (small set) — not a full neworder⋈dispatch scan.
 */
async function loadReportQuoteKeySet(conn) {
  if (
    REPORT_QUOTE_CACHE.keys &&
    Date.now() - REPORT_QUOTE_CACHE.at < REPORT_QUOTE_TTL_MS
  ) {
    return REPORT_QUOTE_CACHE.keys;
  }

  const [rows] = await conn.execute(
    `SELECT DISTINCT ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key
     FROM service_records sr
     INNER JOIN dispatch d
       ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
     WHERE sr.installation_report IS NOT NULL
       AND TRIM(CAST(sr.installation_report AS CHAR)) <> ''
       AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'`,
  );
  const keys = new Set(
    (rows || [])
      .map((r) => String(r.quote_key || "").trim().toLowerCase())
      .filter(Boolean),
  );
  REPORT_QUOTE_CACHE = { at: Date.now(), keys };
  return keys;
}

async function quotesWithInstallationReport(conn, quotes) {
  if (!quotes.length) return new Set();
  // Prefer global cache when warm — avoids per-page dispatch joins.
  if (
    REPORT_QUOTE_CACHE.keys &&
    Date.now() - REPORT_QUOTE_CACHE.at < REPORT_QUOTE_TTL_MS
  ) {
    const set = new Set();
    for (const q of quotes) {
      const key = String(q || "").trim().toLowerCase();
      if (key && REPORT_QUOTE_CACHE.keys.has(key)) set.add(key);
    }
    return set;
  }

  const placeholders = quotes.map(() => "?").join(",");
  const [rows] = await conn.execute(
    `SELECT DISTINCT ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key
     FROM dispatch d
     INNER JOIN service_records sr
       ON ${sqlTrimUtf8EqColumns("sr.serial_number", "d.serial_no")}
     WHERE ${sqlUtf8TrimExpr("d.quote_number")} IN (${placeholders})
       AND UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
       AND sr.installation_report IS NOT NULL
       AND TRIM(CAST(sr.installation_report AS CHAR)) <> ''`,
    quotes,
  );
  return new Set(
    (rows || []).map((r) => String(r.quote_key || "").trim().toLowerCase()).filter(Boolean),
  );
}

async function enrichDispatchAndWarranty(conn, rows) {
  if (!rows?.length) return rows || [];
  const quotes = [
    ...new Set(rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean)),
  ];
  if (!quotes.length) return rows;

  const placeholders = quotes.map(() => "?").join(",");
  const [aggRows] = await conn.execute(
    `SELECT
       ${sqlUtf8TrimExpr("d.quote_number")} AS quote_key,
       GROUP_CONCAT(DISTINCT d.serial_no ORDER BY d.serial_no SEPARATOR ', ') AS serial_number,
       GROUP_CONCAT(DISTINCT d.item_code ORDER BY d.item_code SEPARATOR ', ') AS model,
       GROUP_CONCAT(DISTINCT d.item_name ORDER BY d.item_name SEPARATOR ', ') AS name,
       DATE_FORMAT(MAX(COALESCE(d.updated_at, d.created_at)), '%Y-%m-%d') AS dispatch_date,
       MAX(CASE WHEN wp.serial_number IS NOT NULL THEN 1 ELSE 0 END) AS warranty_registered
     FROM dispatch d
     LEFT JOIN warranty_products wp
       ON ${sqlTrimUtf8EqColumns("wp.serial_number", "d.serial_no")}
     WHERE ${sqlUtf8TrimExpr("d.quote_number")} IN (${placeholders})
       AND d.serial_no IS NOT NULL
       AND ${sqlUtf8TrimExpr("d.serial_no")} <> ''
     GROUP BY ${sqlUtf8TrimExpr("d.quote_number")}`,
    quotes,
  );
  const byQuote = new Map(
    (aggRows || []).map((r) => [String(r.quote_key || "").trim().toLowerCase(), r]),
  );
  return rows.map((row) => {
    const hit = byQuote.get(String(row.quote_number || "").trim().toLowerCase());
    if (!hit) return { ...row, no_feedback_collected: 1 };
    return {
      ...row,
      serial_number: hit.serial_number || row.serial_number || "",
      model: hit.model || row.model || "",
      name: hit.name || row.name || "",
      dispatch_date: hit.dispatch_date || row.dispatch_date || null,
      warranty_registered: Number(hit.warranty_registered) === 1 ? 1 : 0,
      no_feedback_collected: 1,
    };
  });
}

async function fetchInstalledBatch(conn, where, limit, offset) {
  const [rows] = await conn.execute(
    `SELECT
       no.id,
       no.order_id,
       no.quote_number,
       no.invoice_number,
       '' AS serial_number,
       NULL AS service_id,
       NULL AS service_details,
       '' AS model,
       '' AS name,
       no.delivery_location AS delivery_address,
       no.company_name,
       NULLIF(TRIM(no.client_name), '') AS contact_person,
       no.contact,
       no.state,
       no.created_by AS emp_name,
       no.created_by AS order_sales_person,
       NULL AS assigned_by,
       COALESCE(no.installation_status, 0) AS order_installation_status,
       COALESCE(no.dispatch_status, 0) AS order_dispatch_status,
       COALESCE(no.delivery_status, 0) AS order_delivery_status,
       DATE_FORMAT(no.delivery_date, '%Y-%m-%d') AS delivery_date,
       DATE_FORMAT(no.delivered_on, '%Y-%m-%d') AS delivered_on,
       0 AS pricing_total,
       0 AS total_qty,
       CASE
         WHEN no.delivery_date < CURDATE() THEN 'overdue'
         WHEN no.delivery_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 10 DAY) THEN 'upcoming'
         ELSE 'scheduled'
       END AS installation_status,
       CASE
         WHEN no.delivered_on IS NOT NULL AND no.delivered_on > '1970-01-01'
         THEN DATEDIFF(no.delivered_on, CURDATE())
         ELSE DATEDIFF(no.delivery_date, CURDATE())
       END AS days_until_installation,
       0 AS warranty_registered,
       NULL AS registered_at,
       NULL AS registered_by,
       NULL AS dispatch_date,
       NULL AS service_engineer,
       NULL AS third_party_engineer,
       1 AS installation_completed,
       1 AS no_feedback_collected
     FROM neworder no
     ${where.sql}
     ORDER BY no.id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  );
  return rows || [];
}

/** Count installed orders where Google feedback was not recorded as Yes. */
export async function countOpenInstallationNoFeedback(filters = {}) {
  const key = countCacheKey(filters);
  const cached = COUNT_CACHE.get(key);
  if (cached && Date.now() - cached.at < COUNT_TTL_MS) {
    return cached.total;
  }
  const stats = await countOpenInstallationGoogleFeedbackStats(filters);
  const total = stats.no_feedback_collected;
  COUNT_CACHE.set(key, { at: Date.now(), total });
  return total;
}

export async function fetchOpenInstallationNoFeedbackPage(
  filters = {},
  limit = 10,
  skip = 0,
  { skipTotal = true } = {},
) {
  return fetchOpenInstallationGoogleFeedbackPage(filters, "no_feedback", limit, skip, {
    skipTotal,
  });
}
