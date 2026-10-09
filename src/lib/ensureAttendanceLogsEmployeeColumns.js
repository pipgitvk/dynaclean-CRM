import { ensureRepListMachineCodeColumn } from "@/lib/ensureRepListMachineCode";

const GLOBAL_KEY = "__attendanceLogsEmployeeIdMachineCodeColumns__";

async function addColumnIfMissing(conn, sql) {
  try {
    await conn.execute(sql);
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }
}

export async function ensureAttendanceLogsEmployeeColumns(conn) {
  if (global[GLOBAL_KEY]) return;
  await ensureRepListMachineCodeColumn(conn);
  await addColumnIfMissing(
    conn,
    `ALTER TABLE attendance_logs
     ADD COLUMN employee_id INT NULL AFTER username`
  );
  await addColumnIfMissing(
    conn,
    `ALTER TABLE attendance_logs
     ADD COLUMN machine_code VARCHAR(32) NULL AFTER employee_id`
  );

  try {
    await conn.execute(
      `UPDATE attendance_logs
       SET machine_code = NULLIF(TRIM(employee_code), '')
       WHERE (machine_code IS NULL OR TRIM(machine_code) = '')
         AND TRIM(COALESCE(employee_code, '')) <> ''`
    );
  } catch {
    /* employee_code column may not exist */
  }

  try {
    await conn.execute(`ALTER TABLE attendance_logs DROP COLUMN employee_code`);
  } catch (err) {
    const gone =
      err?.code === "ER_CANT_DROP_FIELD_OR_KEY" || err?.code === "ER_BAD_FIELD_ERROR";
    if (!gone) {
      /* ignore */
    }
  }

  try {
    await conn.execute(
      `UPDATE attendance_logs a
       INNER JOIN rep_list r
         ON r.username COLLATE utf8mb4_unicode_ci = a.username COLLATE utf8mb4_unicode_ci
       SET a.employee_id = COALESCE(a.employee_id, r.empId),
           a.machine_code = CASE
             WHEN TRIM(COALESCE(a.machine_code, '')) = '' THEN NULLIF(TRIM(r.machine_code), '')
             ELSE a.machine_code
           END
       WHERE a.employee_id IS NULL
          OR TRIM(COALESCE(a.machine_code, '')) = ''`
    );
  } catch (err) {
    console.warn("attendance_logs employee_id/machine_code backfill skipped:", err.message);
  }
  global[GLOBAL_KEY] = true;
}

export async function lookupAttendanceEmployeeIds(conn, username) {
  await ensureAttendanceLogsEmployeeColumns(conn);
  const [rows] = await conn.execute(
    `SELECT empId, TRIM(machine_code) AS machine_code
     FROM rep_list
     WHERE username = ?
     LIMIT 1`,
    [username]
  );
  const row = rows?.[0];
  const code = String(row?.machine_code || "").trim();
  return {
    employee_id: row?.empId ?? null,
    machine_code: code || null,
  };
}
