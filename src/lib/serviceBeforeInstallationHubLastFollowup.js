import { getDbConnection } from "@/lib/db";
import { ACTIVE_AMC_SQL } from "@/lib/activeAmcSql";
import {
  IN_WARRANTY_SQL,
  OPEN_COMPLAINTS_SQL,
  PENDING_SERVICE_SQL,
} from "@/lib/serviceBeforeInstallationQueries";

const HUB_LAST_FOLLOWUP_CACHE = new Map();
const HUB_LAST_FOLLOWUP_TTL_MS = 60_000;
const CACHE_KEY = "hub-last-followups";

function normalizeHubLastFollowupAt(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getFullYear() < 2000) return null;
    return value;
  }
  const raw = String(value).trim();
  if (!raw || raw.startsWith("0000-00-00") || raw.startsWith("1000-01-01")) return null;
  return raw;
}

function pickFollowedAt(row) {
  return normalizeHubLastFollowupAt(row?.followed_at) || normalizeHubLastFollowupAt(row?.created_at);
}

/**
 * Newest follow-up that matches the segment. Reverse PK scan + LIMIT 1
 * avoids MAX() over the whole machines_followup table.
 */
async function latestFollowedAt(conn, joinAndWhereSql) {
  const [rows] = await conn.execute(
    `SELECT mf.followed_at, mf.created_at
     FROM machines_followup mf
     ${joinAndWhereSql}
     ORDER BY mf.id DESC
     LIMIT 1`,
  );
  return pickFollowedAt(rows?.[0]);
}

async function safeLatest(conn, joinAndWhereSql) {
  try {
    return await latestFollowedAt(conn, joinAndWhereSql);
  } catch (error) {
    console.warn("[sbi hub last-followup]", error?.message || error);
    return null;
  }
}

const ACTIVE_AMC_HUB_SQL = ACTIVE_AMC_SQL.replace(/\bstatus\b/g, "amc_hub.status").replace(
  /\bamc_end_datetime\b/g,
  "amc_hub.amc_end_datetime",
);

/** Hub KPI cards — latest follow-up date per segment (date only, no notes). */
export async function fetchServiceBeforeInstallationHubLastFollowups() {
  const cached = HUB_LAST_FOLLOWUP_CACHE.get(CACHE_KEY);
  if (cached && Date.now() - cached.at < HUB_LAST_FOLLOWUP_TTL_MS) {
    return cached.data;
  }

  const conn = await getDbConnection();

  const [
    total_registered,
    delivered_installation_pending,
    open_completions,
    active_warranty,
    active_amc,
  ] = await Promise.all([
    safeLatest(
      conn,
      `STRAIGHT_JOIN warranty_products wp ON wp.serial_number = mf.serial_number
       INNER JOIN rep_list r_ss ON r_ss.username = mf.added_by
       WHERE UPPER(TRIM(r_ss.userRole)) = 'SERVICE SUPPORT'`,
    ),
    safeLatest(
      conn,
      `STRAIGHT_JOIN dispatch d_oi ON d_oi.serial_no = mf.serial_number
       INNER JOIN neworder no ON no.quote_number = d_oi.quote_number
       WHERE COALESCE(no.installation_status, 0) = 0
         AND no.delivered_on IS NOT NULL
         AND TRIM(CAST(no.delivered_on AS CHAR)) NOT IN ('', '0000-00-00', '0000-00-00 00:00:00')
         AND DATE(no.delivered_on) > '1970-01-01'
         AND TRIM(d_oi.serial_no) <> ''
         AND LOWER(TRIM(d_oi.serial_no)) NOT LIKE 'temp%'`,
    ),
    safeLatest(
      conn,
      `STRAIGHT_JOIN service_records sr ON sr.serial_number = mf.serial_number
       WHERE ${PENDING_SERVICE_SQL}
         AND ${OPEN_COMPLAINTS_SQL}`,
    ),
    safeLatest(
      conn,
      `STRAIGHT_JOIN warranty_products wp ON wp.serial_number = mf.serial_number
       WHERE ${IN_WARRANTY_SQL}`,
    ),
    safeLatest(
      conn,
      `STRAIGHT_JOIN amc_cmc amc_hub ON amc_hub.serial_number = mf.serial_number
       WHERE ${ACTIVE_AMC_HUB_SQL}`,
    ),
  ]);

  const data = {
    total_registered,
    delivered_installation_pending,
    open_completions,
    active_warranty,
    active_amc,
  };

  HUB_LAST_FOLLOWUP_CACHE.set(CACHE_KEY, { at: Date.now(), data });
  return data;
}
