const GLOBAL_KEY = "__repListMachineCodeColumn__";

export async function ensureRepListMachineCodeColumn(conn) {
  if (global[GLOBAL_KEY]) return;
  try {
    await conn.execute(
      `ALTER TABLE rep_list
       ADD COLUMN machine_code VARCHAR(32) NULL
       AFTER empId`
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }

  try {
    await conn.execute(
      `UPDATE rep_list r
       INNER JOIN employee_profiles p
         ON p.username COLLATE utf8mb4_unicode_ci = r.username COLLATE utf8mb4_unicode_ci
       SET r.machine_code = TRIM(p.machine_code)
       WHERE TRIM(COALESCE(p.machine_code, '')) <> ''
         AND (r.machine_code IS NULL OR TRIM(r.machine_code) = '')`
    );
  } catch {
    /* employee_profiles.machine_code may already be dropped */
  }

  try {
    await conn.execute(`ALTER TABLE employee_profiles DROP COLUMN machine_code`);
  } catch (err) {
    const gone =
      err?.code === "ER_CANT_DROP_FIELD_OR_KEY" || err?.code === "ER_BAD_FIELD_ERROR";
    if (!gone) throw err;
  }

  global[GLOBAL_KEY] = true;
}
