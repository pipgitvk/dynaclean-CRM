import {
  normalizeUserKey,
  pickDateOfJoining,
  buildEmployeeProfileIndex,
  resolveEmployeeProfile,
} from "@/lib/employeeProfileLookup";
import { dateToYmdKey } from "@/lib/salaryPayDaysFromAttendance";
import { rowHasMeaningfulCheckinOrCheckout } from "@/lib/attendanceMeaningfulPunch";

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

/** All rep_list rows for sheet lookups (includes inactive). */
export const PAYROLL_SHEET_EMPLOYEE_SQL = `
  SELECT r.username, r.empId, r.userRole, r.userDepartment, r.status
  FROM rep_list r
  WHERE UPPER(TRIM(COALESCE(r.userRole, ''))) <> 'SUPERADMIN'
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
 * Payroll registers (attendance + salary): active rep_list; profile via username or empId; DOJ on/before month end when known.
 * @param {string} monthEndYmd - last calendar day of sheet month (YYYY-MM-DD)
 */
export function filterEmployeesForPayrollSheet(employees, profileRows, monthEndYmd) {
  const profileIndex = buildEmployeeProfileIndex(profileRows);
  const monthEnd = monthEndYmd ? String(monthEndYmd).slice(0, 10) : null;

  return (employees || []).filter((emp) => {
    if (!isPayrollActiveEmployee(emp)) return false;
    const profile = resolveEmployeeProfile(emp, profileIndex);

    const doj = pickDateOfJoining(profile);
    if (doj && monthEnd) {
      const dojKey = dateToYmdKey(doj);
      if (dojKey && dojKey > monthEnd) return false;
    }
    return true;
  });
}

export function approvedLeaveOverlapsMonth(leave, monthFrom, monthTo) {
  const from = dateToYmdKey(leave?.from_date);
  const to = dateToYmdKey(leave?.to_date);
  if (!from || !to || !monthFrom || !monthTo) return false;
  return from <= monthTo && to >= monthFrom;
}

/** Usernames with punch or approved leave in the sheet month (incl. inactive staff). */
export function collectUsernamesWithAttendanceSheetActivity(
  attendanceRows,
  leaves,
  monthFrom,
  monthTo,
) {
  const keys = new Set();
  for (const row of attendanceRows || []) {
    if (rowHasMeaningfulCheckinOrCheckout(row)) {
      const uk = normalizeUserKey(row.username);
      if (uk) keys.add(uk);
    }
  }
  for (const leave of leaves || []) {
    if (String(leave?.status ?? "").toLowerCase() !== "approved") continue;
    if (!approvedLeaveOverlapsMonth(leave, monthFrom, monthTo)) continue;
    const uk = normalizeUserKey(leave.username);
    if (uk) keys.add(uk);
  }
  return keys;
}

function attendanceSheetExtraEligible(emp, monthEndYmd, profileIndex) {
  if (isPayrollSheetExcluded(emp)) return false;
  if (normalizeRepListRole(emp) === "SUPERADMIN") return false;
  if (normalizeUserKey(emp.username) === "admin") return false;
  const profile = resolveEmployeeProfile(emp, profileIndex);
  const doj = pickDateOfJoining(profile);
  if (doj && monthEndYmd) {
    const dojKey = dateToYmdKey(doj);
    if (dojKey && dojKey > monthEndYmd) return false;
  }
  return true;
}

/**
 * Active sheet roster + inactive employees who had attendance or approved leave that month.
 */
export function buildAttendanceSheetEmployeeList(
  activeFiltered,
  allRepRows,
  activityKeys,
  profileRows,
  monthEndYmd,
  usernameByNormalizedKey = new Map(),
) {
  const profileIndex = buildEmployeeProfileIndex(profileRows);
  const activeKeys = new Set(
    (activeFiltered || []).map((e) => normalizeUserKey(e.username)),
  );
  const repByUser = new Map();
  for (const row of allRepRows || []) {
    const uk = normalizeUserKey(row.username);
    if (uk) repByUser.set(uk, row);
  }

  const extras = [];
  for (const uk of activityKeys || []) {
    if (activeKeys.has(uk)) continue;
    const fromRep = repByUser.get(uk);
    if (fromRep) {
      if (!attendanceSheetExtraEligible(fromRep, monthEndYmd, profileIndex)) continue;
      extras.push(fromRep);
      continue;
    }
    const rawName = usernameByNormalizedKey.get(uk) || uk;
    extras.push({
      username: rawName,
      empId: null,
      userRole: "",
      userDepartment: "",
      status: 0,
    });
  }

  extras.sort((a, b) =>
    String(a.username ?? "").localeCompare(String(b.username ?? ""), undefined, {
      sensitivity: "base",
    }),
  );

  return [...(activeFiltered || []), ...extras];
}

/** Active employees for the sheet month (same rules as payroll register). */
export function filterEmployeesForAttendanceSheet(employees, profileRows, monthEndYmd) {
  return filterEmployeesForPayrollSheet(employees, profileRows, monthEndYmd);
}

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
  const profileIndex = buildEmployeeProfileIndex(profileRows);
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
    const profile =
      resolveEmployeeProfile(emp, profileIndex) ||
      profileByUser.get(normalizeUserKey(emp.username)) ||
      {};
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
      const pa =
        resolveEmployeeProfile(a, profileIndex) ||
        profileByUser.get(normalizeUserKey(a.username)) ||
        {};
      const pb =
        resolveEmployeeProfile(b, profileIndex) ||
        profileByUser.get(normalizeUserKey(b.username)) ||
        {};
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

/**
 * Attendance rows for duplicate logins of the same employee.
 * Same-day CRM and machine rows are all kept; pay-day math then takes the
 * earlier check-in and the later check-out.
 */
export function collectPayrollLogsForUsers(logsByUser, relatedUsernames) {
  const logs = [];
  for (const uname of relatedUsernames || []) {
    for (const log of logsByUser[normalizeUserKey(uname)] || []) {
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
