/** Active sales roles that receive monitor / assign targets (same as target-usrname). */
export const TARGET_ELIGIBLE_EMPLOYEE_ROLES = [
  "BACK OFFICE",
  "SALES",
  "SALES CUM BACKOFFICE",
  "SALES HEAD",
  "TEAM LEADER",
  "GEM PORTAL",
];

export function sqlActiveTargetEligibleEmployees(alias = "rl") {
  const a = alias;
  const placeholders = TARGET_ELIGIBLE_EMPLOYEE_ROLES.map(() => "?").join(", ");
  return `${a}.userRole IN (${placeholders})
    AND ${a}.userRole NOT IN ('ADMIN')
    AND ${a}.status = 1`;
}

export const TARGET_ELIGIBLE_EMPLOYEE_ROLE_PARAMS = [...TARGET_ELIGIBLE_EMPLOYEE_ROLES];