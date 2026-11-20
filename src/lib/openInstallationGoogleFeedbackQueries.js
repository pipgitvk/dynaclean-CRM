import { getDbConnection } from "@/lib/db";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  sqlOrderGoogleFeedbackCollected,
  sqlOrderGoogleFeedbackNotCollected,
} from "@/lib/openInstallationGoogleFeedbackSql";
import {
  sqlTrimUtf8EqColumns,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";
import { enrichOpenInstallationRowsWithServices } from "@/lib/openInstallationServiceEnrich";

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

/** Shared neworder WHERE for installed orders + hub filters (no bucket). */
export function buildInstalledOrderGoogleFeedbackWhereSql(filters) {
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
  return { sql, params };
}

export async function countOpenInstallationGoogleFeedbackStats(filters = {}) {
  const conn = await getDbConnection();
  const where = buildInstalledOrderGoogleFeedbackWhereSql(filters);
  const [[row]] = await conn.execute(
    `SELECT
       SUM(CASE WHEN ${sqlOrderGoogleFeedbackCollected("no")} THEN 1 ELSE 0 END) AS feedback_collected,
       SUM(CASE WHEN ${sqlOrderGoogleFeedbackNotCollected("no")} THEN 1 ELSE 0 END) AS no_feedback_collected
     FROM neworder no
     ${where.sql}`,
    where.params,
  );
  return {
    feedback_collected: Number(row?.feedback_collected || 0),
    no_feedback_collected: Number(row?.no_feedback_collected || 0),
  };
}

async function fetchInstalledGoogleFeedbackBatch(conn, where, bucket, limit, offset) {
  const bucketSql =
    bucket === "feedback_collected"
      ? `AND ${sqlOrderGoogleFeedbackCollected("no")}`
      : `AND ${sqlOrderGoogleFeedbackNotCollected("no")}`;

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
       ${bucketSql}
     ORDER BY no.id DESC
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset],
  );
  return rows || [];
}

export async function fetchOpenInstallationGoogleFeedbackPage(
  filters = {},
  bucket = "no_feedback",
  limit = 10,
  skip = 0,
  { skipTotal = true } = {},
) {
  const conn = await getDbConnection();
  const where = buildInstalledOrderGoogleFeedbackWhereSql(filters);
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 200);
  const safeSkip = Math.max(Number(skip) || 0, 0);

  const bucketSql =
    bucket === "feedback_collected"
      ? `AND ${sqlOrderGoogleFeedbackCollected("no")}`
      : `AND ${sqlOrderGoogleFeedbackNotCollected("no")}`;

  let total;
  if (!skipTotal) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM neworder no ${where.sql} ${bucketSql}`,
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
  enriched = await enrichOpenInstallationRowsWithServices(conn, enriched);

  return {
    total,
    hasMore:
      total != null ? safeSkip + enriched.length < total : enriched.length >= safeLimit,
    data: enriched,
  };
}