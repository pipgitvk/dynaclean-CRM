/** Admin dashboard → Service History deep link with filters applied. */
export const ADMIN_SERVICE_HISTORY_PENDING_OVER_48H_HREF =
  "/admin-dashboard/view_service_reports?status=PENDING&pending_over_48h=1";

/** SQL predicate (no leading WHERE). */
export const SERVICE_RECORDS_PENDING_OVER_48H_WHERE = `
  UPPER(TRIM(status)) = 'PENDING'
  AND complaint_date IS NOT NULL
  AND TIMESTAMPDIFF(HOUR, complaint_date, NOW()) > 48
`;

export async function getPendingServiceRecordsOver48hCount(connection) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS c FROM service_records WHERE ${SERVICE_RECORDS_PENDING_OVER_48H_WHERE}`,
  );
  return Number(rows[0]?.c ?? 0);
}

/** Client-side match for ServiceTable filters (uses complaint_date). */
export function isServiceRecordPendingOver48Hours(record) {
  if (String(record?.status ?? "").trim().toUpperCase() !== "PENDING") {
    return false;
  }
  const raw = record?.complaint_date;
  if (raw == null || raw === "" || String(raw).trim() === "N/A") {
    return false;
  }
  const complaint = new Date(raw);
  if (Number.isNaN(complaint.getTime())) return false;
  const hours = (Date.now() - complaint.getTime()) / (1000 * 60 * 60);
  return hours > 48;
}

export function parseServicePendingOver48hFromSearchParam(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}
