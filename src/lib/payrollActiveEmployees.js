/** Active employees for payroll / attendance sheets (matches employee registry “Active”). */
export const PAYROLL_ACTIVE_EMPLOYEE_SQL = `
  SELECT r.username, r.empId, r.userRole, r.userDepartment, r.status
  FROM rep_list r
  WHERE r.status = 1
    AND UPPER(TRIM(COALESCE(r.userRole, ''))) <> 'SUPERADMIN'
    AND LOWER(TRIM(r.username)) <> 'admin'
  ORDER BY r.username ASC
`;

export function isPayrollActiveEmployee(row) {
  if (!row) return false;
  if (Number(row.status) !== 1 && String(row.status) !== "1") return false;
  const role = String(row.userRole ?? "").trim().toUpperCase();
  if (role === "SUPERADMIN") return false;
  if (String(row.username ?? "").trim().toLowerCase() === "admin") return false;
  return true;
}
