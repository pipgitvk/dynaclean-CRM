import { isTempSerialNumber } from "@/lib/openInstallationKpiSql";
import { CRM_DATETIME_24_FORMAT } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay, parseCrmDatetimeToDayjs } from "@/lib/timezone";
import { sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";
import { fetchCustomerFollowupsByContact } from "@/lib/customerFollowupByContact";

function normSerialKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function rowContactKey(row) {
  const contact = String(row?.contact || "").trim();
  const email = String(row?.email || "")
    .trim()
    .toLowerCase();
  return `${contact}::${email}`;
}

function parseFollowupInstant(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getFullYear() < 2000) return null;
    return { raw: value, t: value.getTime() };
  }
  const d = parseCrmDatetimeToDayjs(value);
  if (d?.isValid()) {
    const t = d.valueOf();
    if (t < Date.parse("2000-01-01")) return null;
    return { raw: String(value).trim(), t };
  }
  const raw = String(value).trim();
  if (!raw || raw.startsWith("0000-00-00") || raw.startsWith("1000-01-01")) return null;
  const t = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"));
  if (!Number.isFinite(t) || t < Date.parse("2000-01-01")) return null;
  return { raw, t };
}

export function mergeLastFollowupAt(a, b) {
  const left = parseFollowupInstant(a);
  const right = parseFollowupInstant(b);
  if (!left) return right?.raw ?? null;
  if (!right) return left.raw;
  return left.t >= right.t ? left.raw : right.raw;
}

/** machines_followup — `followed_at` (same as history `sortAt` fallback to `created_at`). */
function machineFollowedAtValue(row) {
  return (
    parseFollowupInstant(row?.followed_at)?.raw ??
    parseFollowupInstant(row?.created_at)?.raw ??
    null
  );
}

function customerFollowedAtValue(row) {
  return (
    parseFollowupInstant(row?.followed_date)?.raw ??
    parseFollowupInstant(row?.time_stamp)?.raw ??
    null
  );
}

/** DD-MM-YYYY HH:mm in IST — same as machine follow-up history. */
export function formatFollowedAtDisplay(value) {
  if (!value) return null;
  return formatCrmDatetimeForISTDisplay(value, CRM_DATETIME_24_FORMAT) || null;
}

export function splitRowSerialNumbers(value) {
  const parts = String(value || "")
    .split(/[\s,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.filter((s) => !isTempSerialNumber(s));
}

function placeholders(n) {
  return Array(n).fill("?").join(", ");
}

/** Same as Follow-up History on Total Registered when `customer_followups=1`. */
const REGISTERED_HISTORY_MACHINE_SQL = `EXISTS (
  SELECT 1 FROM rep_list r_ss
  WHERE r_ss.username = machines_followup.added_by
    AND UPPER(TRIM(r_ss.userRole)) = 'SERVICE SUPPORT'
)`;

function recordMachineFollowupHit(map, key, row) {
  if (!key) return;
  const at = machineFollowedAtValue(row);
  if (!at) return;
  const id = Number(row.id) || 0;
  const prev = map.get(key);
  if (!prev || id > prev.id) {
    map.set(key, { id, at });
  }
}

async function enrichCustomerFollowedAtForRows(conn, rows, { serviceSupportOnly = false } = {}) {
  const pairs = new Map();
  for (const row of rows) {
    const key = rowContactKey(row);
    if (key === "::") continue;
    if (!pairs.has(key)) {
      pairs.set(key, { contact: row.contact, email: row.email });
    }
  }
  const latestByKey = new Map();
  for (const [key, { contact, email }] of pairs) {
    const list = await fetchCustomerFollowupsByContact(conn, contact, email, { serviceSupportOnly });
    let bestAt = null;
    let bestT = -1;
    for (const rec of list) {
      const at = customerFollowedAtValue(rec);
      const p = parseFollowupInstant(at);
      if (p && p.t > bestT) {
        bestT = p.t;
        bestAt = p.raw;
      }
    }
    if (bestAt) latestByKey.set(key, bestAt);
  }
  for (const row of rows) {
    const key = rowContactKey(row);
    const cust = latestByKey.get(key);
    if (cust) {
      row.last_followup_at = mergeLastFollowupAt(row.last_followup_at, cust);
    }
  }
}

/**
 * Attach `last_followup_at` on each row — mirrors Follow-up History (machine + optional customer).
 * @param {object} [options]
 * @param {string} [options.serialField]
 * @param {(row: object) => string[]} [options.getSerials]
 * @param {string} [options.machineIdField] — e.g. warranty_products `id`
 * @param {boolean} [options.includeCustomerFollowups]
 * @param {boolean} [options.matchRegisteredFollowupHistory] — same filters as history modal (SS only)
 */
export async function enrichRowsWithLastMachineFollowup(conn, rows, options = {}) {
  const matchHistory = Boolean(options.matchRegisteredFollowupHistory);
  const machineExtraWhere = matchHistory ? ` AND ${REGISTERED_HISTORY_MACHINE_SQL}` : "";
  if (!rows?.length) return rows;

  const serialField = options.serialField || "serial_number";
  const machineIdField = options.machineIdField || "id";
  const getSerials =
    options.getSerials ||
    ((row) => splitRowSerialNumbers(row[serialField]));

  const serialSet = new Set();
  const machineIds = new Set();
  for (const row of rows) {
    for (const s of getSerials(row)) {
      const trimmed = String(s).trim();
      if (trimmed) serialSet.add(trimmed);
    }
    const mid = Number(row[machineIdField]);
    if (Number.isFinite(mid) && mid > 0) machineIds.add(mid);
  }

  const serials = [...serialSet];
  const ids = [...machineIds];
  const bySerial = new Map();
  const byMachineId = new Map();

  const snExpr = sqlUtf8TrimExpr("serial_number");
  const queries = [];

  if (serials.length) {
    queries.push(
      conn.execute(
        `SELECT id, machine_id, ${snExpr} AS serial_key, followed_at, created_at
         FROM machines_followup
         WHERE ${snExpr} IN (${placeholders(serials.length)})${machineExtraWhere}
         ORDER BY id DESC`,
        serials,
      ),
    );
  }
  if (ids.length) {
    queries.push(
      conn.execute(
        `SELECT id, machine_id, ${snExpr} AS serial_key, followed_at, created_at
         FROM machines_followup
         WHERE machine_id IN (${placeholders(ids.length)})${machineExtraWhere}
         ORDER BY id DESC`,
        ids,
      ),
    );
  }

  if (queries.length) {
    const results = await Promise.all(queries);
    for (const [mfRows] of results) {
      for (const r of mfRows || []) {
        recordMachineFollowupHit(bySerial, normSerialKey(r.serial_key), r);
        const mid = Number(r.machine_id);
        if (Number.isFinite(mid) && mid > 0) {
          recordMachineFollowupHit(byMachineId, mid, r);
        }
      }
    }
  }

  for (const row of rows) {
    let last = null;
    for (const s of getSerials(row)) {
      const hit = bySerial.get(normSerialKey(s))?.at;
      if (hit) last = mergeLastFollowupAt(last, hit);
    }
    const mid = Number(row[machineIdField]);
    if (Number.isFinite(mid) && mid > 0) {
      const hit = byMachineId.get(mid)?.at;
      if (hit) last = mergeLastFollowupAt(last, hit);
    }
    row.last_followup_at = last;
  }

  if (options.includeCustomerFollowups) {
    await enrichCustomerFollowedAtForRows(conn, rows, {
      serviceSupportOnly: matchHistory,
    });
  }

  return rows;
}