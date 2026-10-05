import { normalizeUserKey, pickDateOfJoining } from "@/lib/employeeProfileLookup";
import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";

/** Not shown on attendance / salary registers (roles). */
export const PAYROLL_SHEET_EXCLUDED_ROLES = [];

export const PAYROLL_SHEET_EXCLUDED_USERNAMES = ["neha"];

/** Listed on payroll registers without employee_profiles when rep_list role matches. */
export const ATTENDANCE_SHEET_ROLES_WITHOUT_PROFILE = [
  "SERVICE ENGINEER",
  "PRODUCTION ENGINEER",
  "DIRECTOR",
  "WELDER HELPER",
  "PAINTER",
  "WELDER",
];

export function normalizeRepListRole(emp) {
  return String(emp?.userRole ?? "").trim().toUpperCase();
}

/** Active employees for payroll / attendance sheets (matches employee registry “Active”). */
export const PAYROLL_ACTIVE_EMPLOYEE_SQL = `
  SELECT r.username, r.empId, r.userRole, r.userDepartment, r.status
  FROM rep_list r
  WHERE r.status = 1
    AND UPPER(TRIM(COALESCE(r.userRole, ''))) <> 'SUPERADMIN'
    AND LOWER(TRIM(r.username)) <> 'admin'
    AND LOWER(TRIM(r.username)) <> 'neha'
  ORDER BY r.username ASC
`;

export function isPayrollSheetExcluded(row) {
  if (!row) return true;
  const user = normalizeUserKey(row.username);
  if (PAYROLL_SHEET_EXCLUDED_USERNAMES.includes(user)) return true;
  const role = String(row.userRole ?? "").trim().toUpperCase();
  return PAYROLL_SHEET_EXCLUDED_ROLES.includes(role);
}

export function isPayrollActiveEmployee(row) {
  if (!row) return false;
  if (Number(row.status) !== 1 && String(row.status) !== "1") return false;
  const role = String(row.userRole ?? "").trim().toUpperCase();
  if (role === "SUPERADMIN") return false;
  if (String(row.username ?? "").trim().toLowerCase() === "admin") return false;
  if (isPayrollSheetExcluded(row)) return false;
  return true;
}

/** Map username → employee_profiles row (username key only, no empId cross-match). */
export function buildEmployeeProfileByUsername(profileRows) {
  const map = new Map();
  for (const p of profileRows || []) {
    const uk = normalizeUserKey(p.username);
    if (uk) map.set(uk, p);
  }
  return map;
}

/**
 * Payroll registers (attendance + salary): active rep_list + profile (or field roles) + DOJ on/before month end.
 * @param {string} monthEndYmd - last calendar day of sheet month (YYYY-MM-DD)
 */
export function filterEmployeesForPayrollSheet(employees, profileRows, monthEndYmd) {
  const profileByUser = buildEmployeeProfileByUsername(profileRows);
  const monthEnd = monthEndYmd ? String(monthEndYmd).slice(0, 10) : null;

  return (employees || []).filter((emp) => {
    if (!isPayrollActiveEmployee(emp)) return false;
    const uk = normalizeUserKey(emp.username);
    const profile = profileByUser.get(uk);
    if (!profile) {
      return ATTENDANCE_SHEET_ROLES_WITHOUT_PROFILE.includes(normalizeRepListRole(emp));
    }

    const doj = pickDateOfJoining(profile);
    if (doj && monthEnd) {
      const dojKey = dateToYmdKey(doj);
      if (dojKey && dojKey > monthEnd) return false;
    }
    return true;
  });
}

/** @deprecated use filterEmployeesForPayrollSheet */
export const filterEmployeesForAttendanceSheet = filterEmployeesForPayrollSheet;

function normalizePersonName(value) {
  const s = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalizeUserKey(s);
}

function payrollSheetIdentityKeys(emp, profile) {
  const keys = [];
  const name = normalizePersonName(profile?.full_name);
  if (name) keys.push(`name:${name}`);
  const code = normalizeUserKey(profile?.employee_code);
  if (code) keys.push(`code:${code}`);
  const empId = normalizeUserKey(profile?.empId) || normalizeUserKey(emp?.empId);
  if (empId) keys.push(`emp:${empId}`);
  keys.push(`user:${normalizeUserKey(emp.username)}`);
  return keys;
}

function payrollSheetEmployeePickScore(emp, profile) {
  let s = 0;
  if (normalizeUserKey(emp.username) === normalizeUserKey(profile?.username)) s += 100;
  if (profile?.employee_code) s += 20;
  if (profile?.date_of_joining) s += 10;
  if (profile?.father_name) s += 4;
  if (profile?.full_name) s += 2;
  const dojK = profile?.date_of_joining ? dateToYmdKey(profile.date_of_joining) : null;
  const dobK = profile?.date_of_birth ? dateToYmdKey(profile.date_of_birth) : null;
  if (dojK && dobK && dojK === dobK) s -= 50;
  return s;
}

/**
 * One register row per person when duplicate logins share name, empId, or employee code.
 * @returns {{ employees: object[], relatedUsernamesByWinner: Map<string, string[]> }}
 */
export function dedupeEmployeesForPayrollSheet(employees, profileRows) {
  const profileByUser = buildEmployeeProfileByUsername(profileRows);
  const list = employees || [];
  if (list.length === 0) {
    return { employees: [], relatedUsernamesByWinner: new Map() };
  }

  const parent = list.map((_, i) => i);
  const find = (i) => {
    let root = i;
    while (parent[root] !== root) root = parent[root];
    let cur = i;
    while (cur !== root) {
      const next = parent[cur];
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const keyToIndex = new Map();
  for (let i = 0; i < list.length; i++) {
    const emp = list[i];
    const profile = profileByUser.get(normalizeUserKey(emp.username)) || {};
    for (const key of payrollSheetIdentityKeys(emp, profile)) {
      const prev = keyToIndex.get(key);
      if (prev != null) union(i, prev);
      else keyToIndex.set(key, i);
    }
  }

  const groups = new Map();
  for (let i = 0; i < list.length; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(list[i]);
  }

  const winners = [];
  const relatedUsernamesByWinner = new Map();

  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => {
      const pa = profileByUser.get(normalizeUserKey(a.username)) || {};
      const pb = profileByUser.get(normalizeUserKey(b.username)) || {};
      return payrollSheetEmployeePickScore(b, pb) - payrollSheetEmployeePickScore(a, pa);
    });
    const winner = sorted[0];
    const allUsernames = [];
    for (const e of group) {
      allUsernames.push(e.username);
    }
    winners.push(winner);
    relatedUsernamesByWinner.set(winner.username, allUsernames);
  }

  winners.sort((a, b) =>
    String(a.username ?? "").localeCompare(String(b.username ?? ""), undefined, {
      sensitivity: "base",
    })
  );

  return { employees: winners, relatedUsernamesByWinner };
}

/** Merge attendance logs for duplicate logins (one row per day). */
export function collectPayrollLogsForUsers(logsByUser, relatedUsernames, dateToYmdKeyFn) {
  const logs = [];
  const logDates = new Set();
  for (const uname of relatedUsernames || []) {
    for (const log of logsByUser[normalizeUserKey(uname)] || []) {
      const dk = dateToYmdKeyFn(log.date);
      if (dk && logDates.has(dk)) continue;
      if (dk) logDates.add(dk);
      logs.push(log);
    }
  }
  return logs;
}

export function pickFirstByRelatedUsernames(map, relatedUsernames) {
  for (const uname of relatedUsernames || []) {
    const hit = map.get(normalizeUserKey(uname));
    if (hit != null) return hit;
  }
  return null;
}

export function mergeDeductionsForRelated(deductionsByUser, relatedUsernames) {
  const out = [];
  for (const uname of relatedUsernames || []) {
    out.push(...(deductionsByUser.get(normalizeUserKey(uname)) || []));
  }
  return out;
}

export function sumOvertimeHoursForRelated(recordByUser, relatedUsernames) {
  let total = 0;
  for (const uname of relatedUsernames || []) {
    const row = recordByUser.get(normalizeUserKey(uname));
    if (row?.overtime_hours != null) total += Number(row.overtime_hours) || 0;
  }
  return total;
}

/** Attribute alias-account leaves to the canonical username for payroll math. */
export function normalizeLeavesForRelatedAccounts(leaves, relatedUsernames, primaryUsername) {
  const keys = new Set((relatedUsernames || []).map((u) => normalizeUserKey(u)));
  const primary = primaryUsername;
  return (leaves || []).map((leave) =>
    keys.has(normalizeUserKey(leave.username)) ? { ...leave, username: primary } : leave
  );
}
