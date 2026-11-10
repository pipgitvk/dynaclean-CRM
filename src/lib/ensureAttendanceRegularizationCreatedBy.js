/** Who filed the regularization request (employee or reporting manager on behalf). */
export async function ensureAttendanceRegularizationCreatedByColumn(conn) {
  try {
    await conn.execute(
      `ALTER TABLE attendance_regularization_requests
       ADD COLUMN created_by VARCHAR(255) NULL DEFAULT NULL
       AFTER username`,
    );
  } catch (e) {
    const msg = String(e?.message || "");
    if (e?.code !== "ER_DUP_FIELDNAME" && !msg.includes("Duplicate column")) {
      throw e;
    }
  }
}

export function getAttendanceRegularizationCreatedBy(req) {
  if (!req) return "—";
  const raw =
    req.created_by ??
    req.proxy_submitter_username ??
    req.username;
  const s = String(raw ?? "").trim();
  return s || "—";
}
