/**
 * Designation used for HR target matching: Employee CRM profile first, then rep_list.userDepartment.
 */
export async function resolveHrUserDesignation(conn, username) {
  const [profRows] = await conn.execute(
    `SELECT TRIM(designation) AS designation FROM employee_profiles WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1`,
    [username]
  );
  let d = profRows[0]?.designation?.trim() || "";
  if (d) return d;

  const [repCols] = await conn.execute(`SHOW COLUMNS FROM rep_list LIKE 'userDepartment'`);
  if (repCols.length) {
    const [repRows] = await conn.execute(
      `SELECT TRIM(userDepartment) AS userDepartment FROM rep_list WHERE LOWER(TRIM(username)) = LOWER(TRIM(?)) LIMIT 1`,
      [username]
    );
    d = repRows[0]?.userDepartment?.trim() || "";
  }
  return d;
}
