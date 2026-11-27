import { getDbConnection } from "@/lib/db";
import {
  forceOpenInstallationProductsOnly,
  parseSbiFilters,
} from "@/lib/serviceBeforeInstallationFilters";
import {
  sqlTrimUtf8EqColumns,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { enrichOpenInstallationRowsWithServices } from "@/lib/openInstallationServiceEnrich";

const COUNT_CACHE = new Map();
const COUNT_TTL_MS = 5_000;

function cacheGet(key) {
  const hit = COUNT_CACHE.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > COUNT_TTL_MS) {
    COUNT_CACHE.delete(key);
    return null;
  }
  return hit.data;
}

function cacheSet(key, data) {
  COUNT_CACHE.set(key, { at: Date.now(), data });
  if (COUNT_CACHE.size > 80) {
    COUNT_CACHE.delete(COUNT_CACHE.keys().next().value);
  }
}

function countCacheKey(filters) {
  const f = parseSbiFilters(forceOpenInstallationProductsOnly(filters));
  return JSON.stringify({
    search: f.search || "",
    model: f.model || "",
    state: f.state || "",
    serial: f.serial || "",
    from: f.from || "",
    to: f.to || "",
    salesPerson: f.salesPerson || "",
    warrantyRegistration: f.warrantyRegistration || "",
  });
}

const QUOTE_KEY_SQL = `COALESCE(
  NULLIF(${sqlUtf8TrimExpr("no.quote_number")}, ''),
  CONCAT('sr:', sr.service_id)
)`;

/**
 * Google Feedback Collected card.
 * Starts from service_records (google_feedback_collected = yes).
 * Dispatch "Not completed" is ignored — feedback is almost always after dispatch.
 */
function buildGoogleFeedbackYesFromSql(filters) {
  const f = parseSbiFilters(forceOpenInstallationProductsOnly(filters));
  let sql = `
    FROM service_records sr
    LEFT JOIN dispatch d
      ON ${sqlTrimUtf8EqColumns("d.serial_no", "sr.serial_number")}
     AND d.serial_no IS NOT NULL
     AND TRIM(d.serial_no) <> ''
    LEFT JOIN neworder no
      ON ${sqlTrimUtf8EqColumns("no.quote_number", "d.quote_number")}
     AND (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
     AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
    WHERE UPPER(TRIM(COALESCE(sr.service_type, ''))) = 'INSTALLATION'
      AND LOWER(TRIM(COALESCE(sr.google_feedback_collected, ''))) = 'yes'
  `;
  const params = [];

  if (f.search) {
    const term = `%${f.search}%`;
    sql += ` AND (
      no.order_id LIKE ? OR no.quote_number LIKE ? OR no.company_name LIKE ?
      OR no.contact LIKE ? OR no.invoice_number LIKE ? OR no.delivery_location LIKE ?
      OR no.state LIKE ? OR no.created_by LIKE ?
      OR CAST(sr.service_id AS CHAR) LIKE ?
      OR sr.serial_number LIKE ?
    )`;
    params.push(...Array(8).fill(term), term, term);
  }
  if (f.state) {
    sql += ` AND no.state LIKE ?`;
    params.push(`%${f.state}%`);
  }
  if (f.serial) {
    sql += ` AND (
      no.invoice_number LIKE ? OR no.order_id LIKE ? OR no.quote_number LIKE ?
      OR sr.serial_number LIKE ?
    )`;
    params.push(`%${f.serial}%`, `%${f.serial}%`, `%${f.serial}%`, `%${f.serial}%`);
  }
  if (f.from) {
    sql += ` AND DATE(COALESCE(no.delivery_date, sr.completed_date, sr.reg_date)) >= ?`;
    params.push(f.from);
  }
  if (f.to) {
    sql += ` AND DATE(COALESCE(no.delivery_date, sr.completed_date, sr.reg_date)) <= ?`;
    params.push(f.to);
  }
  if (f.salesPerson) {
    sql += ` AND TRIM(no.created_by) = TRIM(?)`;
    params.push(f.salesPerson);
  }
  if (f.model) {
    sql += ` AND (d.item_code LIKE ? OR sr.serial_number LIKE ?)`;
    params.push(`%${f.model}%`, `%${f.model}%`);
  }
  if (f.warrantyRegistration === "registered") {
    sql += ` AND EXISTS (
      SELECT 1 FROM warranty_products wp
      WHERE ${sqlTrimUtf8EqColumns("wp.serial_number", "sr.serial_number")}
    )`;
  } else if (f.warrantyRegistration === "not_registered") {
    sql += ` AND NOT EXISTS (
      SELECT 1 FROM warranty_products wp
      WHERE ${sqlTrimUtf8EqColumns("wp.serial_number", "sr.serial_number")}
    )`;
  }

  return { sql, params };
}

export async function countOpenInstallationGoogleFeedbackCollected(filters = {}) {
  const key = countCacheKey(filters);
  const cached = cacheGet(key);
  if (cached != null) return cached;

  const conn = await getDbConnection();
  const where = buildGoogleFeedbackYesFromSql(filters);
  const [[row]] = await conn.execute(
    `SELECT COUNT(DISTINCT ${QUOTE_KEY_SQL}) AS feedback_collected
     ${where.sql}`,
    where.params,
  );
  const total = Number(row?.feedback_collected || 0);
  cacheSet(key, total);
  return total;
}

async function enrichGoogleFeedbackDispatch(conn, rows) {
  if (!rows?.length) return rows || [];
  const quotes = [
    ...new Set(rows.map((r) => String(r.quote_number || "").trim()).filter(Boolean)),
  ];
  if (!quotes.length) return rows;

  const placeholders = quotes.map(() => "?");
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
     WHERE ${sqlUtf8TrimExpr("d.quote_number")} IN (${placeholders.join(",")})
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
    if (!hit) return row;
    return {
      ...row,
      serial_number: hit.serial_number || row.serial_number || "",
      model: hit.model || row.model || "",
      name: hit.name || row.name || "",
      dispatch_date: hit.dispatch_date || row.dispatch_date || null,
      warranty_registered: Number(hit.warranty_registered) === 1 ? 1 : 0,
    };
  });
}

export async function fetchOpenInstallationGoogleFeedbackCollectedPage(
  filters = {},
  limit = 10,
  skip = 0,
  { skipTotal = true, skipServiceEnrich = false } = {},
) {
  const conn = await getDbConnection();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);
  const where = buildGoogleFeedbackYesFromSql(filters);

  let total;
  if (!skipTotal) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(DISTINCT ${QUOTE_KEY_SQL}) AS cnt ${where.sql}`,
      where.params,
    );
    total = Number(countRow?.cnt || 0);
  }

  const [rows] = await conn.execute(
    `SELECT
       MAX(no.id) AS id,
       MAX(no.order_id) AS order_id,
       ${QUOTE_KEY_SQL} AS quote_number,
       MAX(no.invoice_number) AS invoice_number,
       GROUP_CONCAT(DISTINCT sr.serial_number ORDER BY sr.serial_number SEPARATOR ', ') AS serial_number,
       GROUP_CONCAT(DISTINCT sr.service_id ORDER BY sr.service_id SEPARATOR ', ') AS service_id,
       NULL AS service_details,
       GROUP_CONCAT(DISTINCT d.item_code ORDER BY d.item_code SEPARATOR ', ') AS model,
       GROUP_CONCAT(DISTINCT d.item_name ORDER BY d.item_name SEPARATOR ', ') AS name,
       MAX(no.delivery_location) AS delivery_address,
       MAX(no.company_name) AS company_name,
       NULLIF(TRIM(MAX(no.client_name)), '') AS contact_person,
       MAX(no.contact) AS contact,
       MAX(no.state) AS state,
       MAX(no.created_by) AS emp_name,
       MAX(no.created_by) AS order_sales_person,
       NULL AS assigned_by,
       MAX(COALESCE(no.installation_status, 0)) AS order_installation_status,
       MAX(COALESCE(no.dispatch_status, 0)) AS order_dispatch_status,
       MAX(COALESCE(no.delivery_status, 0)) AS order_delivery_status,
       DATE_FORMAT(MAX(no.delivery_date), '%Y-%m-%d') AS delivery_date,
       DATE_FORMAT(MAX(no.delivered_on), '%Y-%m-%d') AS delivered_on,
       0 AS pricing_total,
       0 AS total_qty,
       'scheduled' AS installation_status,
       0 AS days_until_installation,
       0 AS warranty_registered,
       NULL AS registered_at,
       NULL AS registered_by,
       NULL AS dispatch_date,
       NULL AS service_engineer,
       NULL AS third_party_engineer,
       1 AS installation_completed,
       0 AS no_feedback_collected,
       'yes' AS google_feedback_collected,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           NULLIF(TRIM(sr.google_feedback_collection), '')
           ORDER BY sr.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS google_feedback_collection,
       SUBSTRING_INDEX(
         GROUP_CONCAT(
           NULLIF(TRIM(sr.google_feedback_proof), '')
           ORDER BY sr.service_id DESC
           SEPARATOR '||'
         ),
         '||',
         1
       ) AS google_feedback_proof
     ${where.sql}
     GROUP BY ${QUOTE_KEY_SQL}
     ORDER BY MAX(COALESCE(no.id, sr.service_id)) DESC
     LIMIT ? OFFSET ?`,
    [...where.params, safeLimit, safeSkip],
  );

  let enriched = await enrichGoogleFeedbackDispatch(conn, rows || []);
  if (!skipServiceEnrich) {
    enriched = await enrichOpenInstallationRowsWithServices(conn, enriched);
  }

  return {
    total,
    hasMore:
      total != null ? safeSkip + enriched.length < total : enriched.length >= safeLimit,
    data: enriched,
  };
}