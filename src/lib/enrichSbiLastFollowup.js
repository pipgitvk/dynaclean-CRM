import { isTempSerialNumber } from "@/lib/openInstallationKpiSql";
import { CRM_DATETIME_24_FORMAT } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay } from "@/lib/timezone";

function normSerialKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseFollowupInstant(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!raw || raw.startsWith("0000-00-00") || raw.startsWith("1000-01-01")) return null;
  const t = Date.parse(raw);
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

/** Latest machines_followup row — only `followed_at` (not next follow-up date). */
function followedAtFromMachineFollowupRow(row) {
  return parseFollowupInstant(row?.followed_at)?.raw ?? null;
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

/**
 * Attach `last_followup_at` on each row from latest machines_followup per serial.
 * @param {object} [options]
 * @param {string} [options.serialField]
 * @param {(row: object) => string[]} [options.getSerials]
 */
export async function enrichRowsWithLastMachineFollowup(conn, rows, options = {}) {
  if (!rows?.length) return rows;

  const serialField = options.serialField || "serial_number";
  const getSerials =
    options.getSerials ||
    ((row) => splitRowSerialNumbers(row[serialField]));

  const serialSet = new Set();
  for (const row of rows) {
    for (const s of getSerials(row)) {
      const key = normSerialKey(s);
      if (key) serialSet.add(String(s).trim());
    }
  }

  const serials = [...serialSet];
  const bySerial = new Map();

  if (serials.length) {
    const [mfRows] = await conn.execute(
      `SELECT mf.serial_number, mf.followed_at
       FROM machines_followup mf
       INNER JOIN (
         SELECT serial_number, MAX(id) AS max_id
         FROM machines_followup
         WHERE serial_number IN (${placeholders(serials.length)})
         GROUP BY serial_number
       ) latest
         ON mf.serial_number = latest.serial_number AND mf.id = latest.max_id`,
      serials,
    );
    for (const r of mfRows) {
      const key = normSerialKey(r.serial_number);
      if (!key) continue;
      bySerial.set(key, followedAtFromMachineFollowupRow(r));
    }
  }

  for (const row of rows) {
    let last = null;
    for (const s of getSerials(row)) {
      const hit = bySerial.get(normSerialKey(s));
      if (hit) last = mergeLastFollowupAt(last, hit);
    }
    row.last_followup_at = last;
  }

  return rows;
}