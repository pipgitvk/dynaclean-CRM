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
import {
  sqlOrderGoogleFeedbackCollected,
  sqlOrderGoogleFeedbackNotCollected,
} from "@/lib/openInstallationGoogleFeedbackSql";

const GF_COUNT_CACHE = new Map();
const GF_CACHE_TTL_MS = 8_000;

function gfCacheGet(map, key) {
  const hit = map.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > GF_CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return hit.data;
}

function gfCacheSet(map, key, data) {
  map.set(key, { at: Date.now(), data });
  if (map.size > 80) {
    const oldest = map.keys().next().value;
    map.delete(oldest);
  }
}

async function enrichDispatchLite(conn, rows) {
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
     INNER JOIN products_list pl_gf
       ON ${sqlTrimUtf8EqColumns("pl_gf.item_code", "d.item_code")}
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
    if (!hit) return row;
    const registered = Number(hit.warranty_registered) === 1;
    return {
      ...row,
      serial_number: hit.serial_number || row.serial_number || "",
      model: hit.model || row.model || "",
      name: hit.name || row.name || "",
      dispatch_date: hit.dispatch_date || row.dispatch_date || null,
      warranty_registered: registered ? 1 : 0,
    };
  });
}

/** Shared neworder WHERE for installed orders + hub filters. */
export function buildInstalledOrderGoogleFeedbackWhereSql(filters) {
  const f = parseSbiFilters(forceOpenInstallationProductsOnly(filters));
  let sql = `
    WHERE (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
      AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
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
  if (f.dispatchStatus === "not_completed") {
    sql += ` AND COALESCE(no.dispatch_status, 0) = 0`;
  } else if (f.dispatchStatus === "completed") {
    sql += ` AND COALESCE(no.dispatch_status, 0) = 1`;
  }
  if (f.warrantyRegistration === "registered") {
    sql += ` AND EXISTS (
      SELECT 1
      FROM dispatch d_wr
      INNER JOIN warranty_products wp_wr
        ON ${sqlTrimUtf8EqColumns("wp_wr.serial_number", "d_wr.serial_no")}
      WHERE ${sqlTrimUtf8EqColumns("d_wr.quote_number", "no.quote_number")}
        AND d_wr.serial_no IS NOT NULL
        AND ${sqlUtf8TrimExpr("d_wr.serial_no")} <> ''
    )`;
  } else if (f.warrantyRegistration === "not_registered") {
    sql += ` AND NOT EXISTS (
      SELECT 1
      FROM dispatch d_wr
      INNER JOIN warranty_products wp_wr
        ON ${sqlTrimUtf8EqColumns("wp_wr.serial_number", "d_wr.serial_no")}
      WHERE ${sqlTrimUtf8EqColumns("d_wr.quote_number", "no.quote_number")}
        AND d_wr.serial_no IS NOT NULL
        AND ${sqlUtf8TrimExpr("d_wr.serial_no")} <> ''
    )`;
  }
  return { sql, params };
}

export async function countOpenInstallationGoogleFeedbackStats(filters = {}) {
  const f = parseSbiFilters(forceOpenInstallationProductsOnly(filters));
  const cacheKey = JSON.stringify({
    search: f.search,
    model: f.model,
    state: f.state,
    serial: f.serial,
    from: f.from,
    to: f.to,
    salesPerson: f.salesPerson,
    warrantyRegistration: f.warrantyRegistration,
    dispatchStatus: f.dispatchStatus,
  });
  const cached = gfCacheGet(GF_COUNT_CACHE, cacheKey);
  if (cached) return cached;

  const conn = await getDbConnection();
  const where = buildInstalledOrderGoogleFeedbackWhereSql(f);
  const [[yesRow]] = await conn.execute(
    `SELECT COUNT(*) AS feedback_collected
     FROM neworder no
     ${where.sql}
     AND ${sqlOrderGoogleFeedbackCollected("no")}`,
    where.params,
  );
  const [[noRow]] = await conn.execute(
    `SELECT COUNT(*) AS no_feedback_collected
     FROM neworder no
     ${where.sql}
     AND ${sqlOrderGoogleFeedbackNotCollected("no")}`,
    where.params,
  );
  const data = {
    feedback_collected: Number(yesRow?.feedback_collected || 0),
    no_feedback_collected: Number(noRow?.no_feedback_collected || 0),
  };
  gfCacheSet(GF_COUNT_CACHE, cacheKey, data);
  return data;
}

async function fetchInstalledGoogleFeedbackBatch(conn, where, bucket, limit, offset) {

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
       'scheduled' AS installation_status,
       0 AS days_until_installation,
       0 AS warranty_registered,
       NULL AS registered_at,
       NULL AS registered_by,
       NULL AS dispatch_date,
       NULL AS service_engineer,
       NULL AS third_party_engineer,
       1 AS installation_completed,
       ${bucket === "no_feedback" ? 1 : 0} AS no_feedback_collected
     FROM neworder no
     ${where.sql}
     ORDER BY no.id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  );
  return rows || [];
}

export async function fetchOpenInstallationGoogleFeedbackPage(
  filters = {},
  bucket = "feedback_collected",
  limit = 10,
  skip = 0,
  { skipTotal = true, skipServiceEnrich = true } = {},
) {
  const conn = await getDbConnection();
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const baseWhere = buildInstalledOrderGoogleFeedbackWhereSql(filters);
  const bucketSql =
    bucket === "no_feedback"
      ? sqlOrderGoogleFeedbackNotCollected("no")
      : sqlOrderGoogleFeedbackCollected("no");
  const where = {
    sql: `${baseWhere.sql} AND ${bucketSql}`,
    params: baseWhere.params,
  };

  let total;
  if (!skipTotal) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM neworder no ${where.sql}`,
      where.params,
    );
    total = Number(countRow?.cnt || 0);
  }

  const rows = await fetchInstalledGoogleFeedbackBatch(
    conn,
    where,
    bucket,
    safeLimit,
    safeSkip,
  );
  let enriched = await enrichDispatchLite(conn, rows);
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