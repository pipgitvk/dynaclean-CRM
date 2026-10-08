import { getDbConnection } from "@/lib/db";
import { ensureMachineAttendancePunchesTable } from "@/lib/ensureMachineAttendancePunchesTable";
import { getISTDateString, getISTDateTimeString } from "@/lib/istDateTime";
import {
  fetchEtimeOfficePunchData,
  formatEtimeOfficeApiDate,
  normalizeEtimeOfficePunchRow,
} from "@/lib/etimeOfficePunchApi";

function parseYmd(s) {
  const t = String(s || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/** Current month (IST): 1st through today. Matches admin machine-attendance default range. */
export function currentMonthMachineAttendanceRangeIst() {
  const today = getISTDateString();
  const from = `${today.slice(0, 7)}-01`;
  return { from, to: today };
}

function formatSyncAt(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return getISTDateTimeString(value);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return `${m[1]} ${m[2]}`;
  return s || null;
}

export async function getLastMachineAttendanceSync(conn) {
  const [metaRows] = await conn.execute(
    `SELECT last_sync_at, source, synced_by, range_from, range_to,
            fetched, inserted_count, updated_count, skipped
     FROM machine_attendance_sync_meta
     WHERE id = 1
     LIMIT 1`
  );
  const meta = metaRows?.[0];
  if (meta?.last_sync_at) {
    return {
      at: formatSyncAt(meta.last_sync_at),
      source: meta.source || null,
      syncedBy: meta.synced_by || null,
      from: meta.range_from ? formatSyncAt(meta.range_from)?.slice(0, 10) : null,
      to: meta.range_to ? formatSyncAt(meta.range_to)?.slice(0, 10) : null,
      fetched: Number(meta.fetched ?? 0),
      inserted: Number(meta.inserted_count ?? 0),
      updated: Number(meta.updated_count ?? 0),
      skipped: Number(meta.skipped ?? 0),
    };
  }

  const [punchRows] = await conn.execute(
    `SELECT MAX(synced_at) AS last_sync_at FROM machine_attendance_punches`
  );
  const at = formatSyncAt(punchRows?.[0]?.last_sync_at);
  return at ? { at, source: null, syncedBy: null } : null;
}

async function saveLastMachineAttendanceSync(conn, payload) {
  await conn.execute(
    `INSERT INTO machine_attendance_sync_meta
      (id, last_sync_at, source, synced_by, range_from, range_to,
       fetched, inserted_count, updated_count, skipped)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
      last_sync_at = VALUES(last_sync_at),
      source = VALUES(source),
      synced_by = VALUES(synced_by),
      range_from = VALUES(range_from),
      range_to = VALUES(range_to),
      fetched = VALUES(fetched),
      inserted_count = VALUES(inserted_count),
      updated_count = VALUES(updated_count),
      skipped = VALUES(skipped)`,
    [
      payload.at,
      payload.source,
      payload.syncedBy,
      payload.from,
      payload.to,
      payload.fetched,
      payload.inserted,
      payload.updated,
      payload.skipped,
    ]
  );
}

/**
 * Pull punches from eTimeOffice into machine_attendance_punches.
 */
export async function syncMachineAttendanceFromEtimeOffice(options = {}) {
  const from = parseYmd(options.from);
  const to = parseYmd(options.to);
  if (!from || !to) {
    throw new Error("from and to (YYYY-MM-DD) are required.");
  }
  if (from > to) {
    throw new Error("from date must be on or before to date.");
  }

  const empCode = String(options.empCode ?? "ALL").trim() || "ALL";
  const dayStart = String(options.dayStart ?? "09:30").trim();
  const dayEnd = String(options.dayEnd ?? "18:30").trim();
  const fromApiDate = formatEtimeOfficeApiDate(from, dayStart);
  const toApiDate = formatEtimeOfficeApiDate(to, dayEnd);
  if (!fromApiDate || !toApiDate) {
    throw new Error("Invalid date or time range.");
  }

  const { punches } = await fetchEtimeOfficePunchData({
    empCode,
    fromApiDate,
    toApiDate,
  });

  const conn = await getDbConnection();
  await ensureMachineAttendancePunchesTable(conn);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of punches) {
    const row = normalizeEtimeOfficePunchRow(raw);
    if (!row) {
      skipped += 1;
      continue;
    }
    const [result] = await conn.execute(
      `INSERT INTO machine_attendance_punches
          (emp_code, employee_name, punch_datetime, m_flag, raw_punch_date, source_uid)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
          employee_name = VALUES(employee_name),
          punch_datetime = VALUES(punch_datetime),
          m_flag = VALUES(m_flag),
          raw_punch_date = VALUES(raw_punch_date),
          synced_at = CURRENT_TIMESTAMP`,
      [
        row.emp_code,
        row.employee_name,
        row.punch_datetime,
        row.m_flag,
        row.raw_punch_date,
        row.source_uid,
      ]
    );
    const aff = Number(result?.affectedRows ?? 0);
    if (aff === 1) inserted += 1;
    else if (aff === 2) updated += 1;
  }

  const lastSyncAt = getISTDateTimeString();
  const lastSync = {
    at: lastSyncAt,
    source: String(options.source || "manual").trim() || "manual",
    syncedBy: options.syncedBy || null,
    from,
    to,
    fetched: punches.length,
    inserted,
    updated,
    skipped,
  };
  await saveLastMachineAttendanceSync(conn, lastSync);

  return {
    fetched: punches.length,
    inserted,
    updated,
    skipped,
    lastSync,
    range: { from, to, empCode, fromApiDate, toApiDate },
  };
}
