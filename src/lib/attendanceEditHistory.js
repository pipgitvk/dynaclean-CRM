import { ensureAttendanceEditHistoryTable } from "@/lib/ensureAttendanceEditHistoryTable";

export const ATTENDANCE_EDIT_TRACKED_FIELDS = [
  "checkin_time",
  "checkout_time",
  "break_morning_start",
  "break_morning_end",
  "break_lunch_start",
  "break_lunch_end",
  "break_evening_start",
  "break_evening_end",
];

const FIELD_LABELS = {
  checkin_time: "Check-in",
  checkout_time: "Check-out",
  break_morning_start: "Morning break — start",
  break_morning_end: "Morning break — end",
  break_lunch_start: "Lunch break — start",
  break_lunch_end: "Lunch break — end",
  break_evening_start: "Evening break — start",
  break_evening_end: "Evening break — end",
};

const SOURCE_LABELS = {
  admin_times_modal: "Edit attendance times",
  admin_full_edit: "Edit attendance log",
  bulk_import: "Bulk import",
};

export function attendanceEditFieldLabel(field) {
  return FIELD_LABELS[field] || field;
}

export function attendanceEditSourceLabel(source) {
  return SOURCE_LABELS[source] || source || "Edit";
}

/** Normalize DB / API datetime to comparable string or null. */
export function normalizeAttendanceEditValue(value) {
  if (value == null || String(value).trim() === "") return null;
  const t = String(value).trim();
  const m = t.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/
  );
  if (m) {
    const hh = String(parseInt(m[4], 10)).padStart(2, "0");
    const mm = String(parseInt(m[5], 10)).padStart(2, "0");
    const ss = m[6] != null ? String(parseInt(m[6], 10)).padStart(2, "0") : "00";
    return `${m[1]}-${m[2]}-${m[3]} ${hh}:${mm}:${ss}`;
  }
  const timeOnly = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeOnly) {
    const hh = String(parseInt(timeOnly[1], 10)).padStart(2, "0");
    const mm = String(parseInt(timeOnly[2], 10)).padStart(2, "0");
    const ss =
      timeOnly[3] != null ? String(parseInt(timeOnly[3], 10)).padStart(2, "0") : "00";
    return `__time__${hh}:${mm}:${ss}`;
  }
  return t;
}

export function formatAttendanceEditDisplayValue(value) {
  const n = normalizeAttendanceEditValue(value);
  if (n == null) return "—";
  const m = n.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return n;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
}

/**
 * @param {Record<string, unknown>} beforeRow
 * @param {Record<string, unknown>} afterValues — keys = field names, values = new raw values
 */
export function diffAttendanceEditFields(beforeRow, afterValues, fields = ATTENDANCE_EDIT_TRACKED_FIELDS) {
  const changes = [];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(afterValues, field)) continue;
    const oldNorm = normalizeAttendanceEditValue(beforeRow?.[field]);
    const newNorm = normalizeAttendanceEditValue(afterValues[field]);
    if (oldNorm === newNorm) continue;
    changes.push({
      field,
      label: attendanceEditFieldLabel(field),
      old_value: formatAttendanceEditDisplayValue(beforeRow?.[field]),
      new_value: formatAttendanceEditDisplayValue(afterValues[field]),
    });
  }
  return changes;
}

export async function recordAttendanceEditHistory(
  conn,
  { username, logDate, editedBy, source, changes }
) {
  if (!changes?.length) return;
  await ensureAttendanceEditHistoryTable(conn);
  await conn.execute(
    `INSERT INTO attendance_log_edit_history
      (username, log_date, edited_by, edit_source, changes_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      username,
      logDate,
      editedBy || "unknown",
      source || "edit",
      JSON.stringify(changes),
    ]
  );
}

export async function fetchAttendanceEditHistory(conn, username, logDate) {
  await ensureAttendanceEditHistoryTable(conn);
  const [rows] = await conn.execute(
    `SELECT id, edited_by, edit_source, changes_json, created_at
     FROM attendance_log_edit_history
     WHERE username = ? AND log_date = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 100`,
    [username, logDate]
  );
  return (rows || []).map((row) => {
    let changes = [];
    try {
      changes = JSON.parse(row.changes_json || "[]");
    } catch {
      changes = [];
    }
    return {
      id: row.id,
      edited_by: row.edited_by,
      edit_source: row.edit_source,
      edit_source_label: attendanceEditSourceLabel(row.edit_source),
      changes,
      created_at: row.created_at,
    };
  });
}
