const GLOBAL_KEY = "__employeeProfilesMachineCodeColumn__";

export async function ensureEmployeeProfileMachineCodeColumn(conn) {
  if (global[GLOBAL_KEY]) return;
  try {
    await conn.execute(
      `ALTER TABLE employee_profiles
       ADD COLUMN machine_code VARCHAR(32) NULL
       AFTER employee_code`
    );
  } catch (err) {
    if (err?.code !== "ER_DUP_FIELDNAME") throw err;
  }
  global[GLOBAL_KEY] = true;
}
