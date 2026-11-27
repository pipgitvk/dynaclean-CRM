import { isTempSerialNumber } from "@/lib/openInstallationKpiSql";
import { CRM_DATETIME_24_FORMAT } from "@/lib/crmDateFormat";
import { formatCrmDatetimeForISTDisplay, parseCrmDatetimeToDayjs } from "@/lib/timezone";

function normSerialKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
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

export function mergeFollowupPick(a, b) {
  if (!b?.at) return a ?? null;
  if (!a?.at) return b;
  const tA = parseFollowupInstant(a.at)?.t ?? -1;
  const tB = parseFollowupInstant(b.at)?.t ?? -1;
  return tB >= tA ? b : a;
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

const SS_JOIN_MF = `INNER JOIN rep_list r_ss
  ON r_ss.username = mf.added_by
 AND UPPER(TRIM(r_ss.userRole)) = 'SERVICE SUPPORT'`;

const SS_JOIN_CF = `INNER JOIN rep_list r_ss
  ON r_ss.username = cf.followed_by
 AND UPPER(TRIM(r_ss.userRole)) = 'SERVICE SUPPORT'`;

function machineFollowupPick(row) {
  const at = machineFollowedAtValue(row);
  if (!at) return null;
  return {
    id: Number(row.id) || 0,
    at,
    notes: String(row?.notes ?? "").trim(),
  };
}

function recordMachineFollowupHit(map, key, row) {
  if (!key) return;
  const pick = machineFollowupPick(row);
  if (!pick) return;
  const prev = map.get(key);
  if (!prev || pick.id > prev.id) {
    map.set(key, pick);
  }
}

/** neworder.id is not warranty_products.id — matching it pulls another machine's history. */
function rowMachineFollowupId(row, machineIdField) {
  if (!machineIdField || !row) return null;
  if (
    machineIdField === "id" &&
    String(row.quote_number ?? "").trim() !== ""
  ) {
    return null;
  }
  const mid = Number(row[machineIdField]);
  return Number.isFinite(mid) && mid > 0 ? mid : null;
}

function phoneDigits(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : "";
}

function customerFollowupMatchesRow(rec, row) {
  const recCid = Number(rec.customer_id);
  const rowCid = Number(row.customer_id);
  if (recCid > 0 && recCid === rowCid) return true;
  const recContact = String(rec.contact || "").trim();
  const rowContact = String(row.contact || "").trim();
  if (recContact && rowContact && recContact === rowContact) return true;
  const recEmail = String(rec.email || "")
    .trim()
    .toLowerCase();
  const rowEmail = String(row.email || "")
    .trim()
    .toLowerCase();
  if (recEmail && rowEmail && recEmail === rowEmail) return true;
  const recPhone = phoneDigits(rec.contact);
  const rowPhone = phoneDigits(row.contact);
  return Boolean(recPhone && recPhone === rowPhone);
}

/**
 * One indexed lookup for the current page — not per-row REGEXP scans.
 */
async function enrichCustomerFollowedAtForRows(conn, rows, { serviceSupportOnly = false } = {}) {
  const customerIds = [
    ...new Set(
      rows
        .map((row) => Number(row.customer_id))
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  ];
  const contacts = [
    ...new Set(rows.map((row) => String(row.contact || "").trim()).filter(Boolean)),
  ];
  const emails = [
    ...new Set(
      rows
        .map((row) => String(row.email || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
  if (!customerIds.length && !contacts.length && !emails.length) return;

  const ssJoin = serviceSupportOnly ? SS_JOIN_CF.replace(/\bcf\./g, "cf2.") : "";
  const list = [];

  async function loadLatest(whereSql, params, groupBySql) {
    const [rows] = await conn.execute(
      `SELECT cf.s_no, cf.customer_id, cf.contact, cf.email, cf.followed_date, cf.time_stamp, cf.notes
       FROM customers_followup cf
       INNER JOIN (
         SELECT MAX(cf2.s_no) AS s_no
         FROM customers_followup cf2
         ${ssJoin}
         WHERE ${whereSql}
         GROUP BY ${groupBySql}
       ) latest ON latest.s_no = cf.s_no`,
      params,
    );
    if (rows?.length) list.push(...rows);
  }

  if (customerIds.length) {
    await loadLatest(
      `cf2.customer_id IN (${placeholders(customerIds.length)})`,
      customerIds,
      "cf2.customer_id",
    );
  } else {
    if (contacts.length) {
      await loadLatest(
        `cf2.contact IN (${placeholders(contacts.length)})`,
        contacts,
        "cf2.contact",
      );
    }
    if (emails.length) {
      await loadLatest(
        `LOWER(TRIM(cf2.email)) IN (${placeholders(emails.length)})`,
        emails,
        "LOWER(TRIM(cf2.email))",
      );
    }
  }

  for (const row of rows) {
    let best = null;
    let bestT = -1;
    for (const rec of list || []) {
      if (!customerFollowupMatchesRow(rec, row)) continue;
      const at = customerFollowedAtValue(rec);
      const p = parseFollowupInstant(at);
      if (!p || p.t <= bestT) continue;
      bestT = p.t;
      best = {
        id: Number(rec.s_no) || 0,
        at: p.raw,
        notes: String(rec?.notes ?? "").trim(),
      };
    }
    if (!best) continue;
    const machinePick = row.last_followup_at
      ? { at: row.last_followup_at, notes: row.last_followup_notes || "", id: 0 }
      : null;
    const merged = mergeFollowupPick(machinePick, best);
    if (merged) {
      row.last_followup_at = merged.at;
      row.last_followup_notes = merged.notes || "";
    }
  }
}

/**
 * Attach `last_followup_at` on each row — mirrors Follow-up History (machine + optional customer).
 * @param {object} [options]
 * @param {string} [options.serialField]
 * @param {(row: object) => string[]} [options.getSerials]
 * @param {string|null} [options.machineIdField] — warranty_products id; `null` skips (do not use neworder.id)
 * @param {boolean} [options.includeCustomerFollowups]
 * @param {boolean} [options.matchRegisteredFollowupHistory] — same filters as history modal (SS only)
 */
export async function enrichRowsWithLastMachineFollowup(conn, rows, options = {}) {
  const matchHistory = Boolean(options.matchRegisteredFollowupHistory);
  if (!rows?.length) return rows;

  const serialField = options.serialField || "serial_number";
  const machineIdField =
    options.machineIdField === undefined ? "id" : options.machineIdField;
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
    const mid = rowMachineFollowupId(row, machineIdField);
    if (mid != null) machineIds.add(mid);
  }

  const serials = [...serialSet];
  const ids = [...machineIds];
  const bySerial = new Map();
  const byMachineId = new Map();
  const ssJoin = matchHistory ? SS_JOIN_MF.replace(/\bmf\./g, "mf2.") : "";

  async function loadLatestMachines(whereSql, params, groupBySql) {
    const [mfRows] = await conn.execute(
      `SELECT mf.id, mf.machine_id, mf.serial_number AS serial_key, mf.followed_at, mf.created_at, mf.notes
       FROM machines_followup mf
       INNER JOIN (
         SELECT MAX(mf2.id) AS id
         FROM machines_followup mf2
         ${ssJoin}
         WHERE ${whereSql}
         GROUP BY ${groupBySql}
       ) latest ON latest.id = mf.id`,
      params,
    );
    for (const r of mfRows || []) {
      recordMachineFollowupHit(bySerial, normSerialKey(r.serial_key), r);
      const mid = Number(r.machine_id);
      if (Number.isFinite(mid) && mid > 0) {
        recordMachineFollowupHit(byMachineId, mid, r);
      }
    }
  }

  if (serials.length) {
    await loadLatestMachines(
      `mf2.serial_number IN (${placeholders(serials.length)})`,
      serials,
      "mf2.serial_number",
    );
  }
  if (ids.length) {
    await loadLatestMachines(
      `mf2.machine_id IN (${placeholders(ids.length)})`,
      ids,
      "mf2.machine_id",
    );
  }

  for (const row of rows) {
    let pick = null;
    for (const s of getSerials(row)) {
      pick = mergeFollowupPick(pick, bySerial.get(normSerialKey(s)));
    }
    const mid = rowMachineFollowupId(row, machineIdField);
    if (mid != null) {
      pick = mergeFollowupPick(pick, byMachineId.get(mid));
    }
    if (pick) {
      row.last_followup_at = pick.at;
      row.last_followup_notes = pick.notes || "";
    } else {
      row.last_followup_at = null;
      row.last_followup_notes = "";
    }
  }

  if (options.includeCustomerFollowups) {
    await enrichCustomerFollowedAtForRows(conn, rows, {
      serviceSupportOnly: matchHistory,
    });
  }

  return rows;
}