import { getDbConnection } from "@/lib/db";
import { ensureCrmEmployeeRolesTable } from "@/lib/ensureCrmEmployeeRolesTable";
import {
  BASE_EMPLOYEE_ROLES,
  mergeEmployeeRoleLists,
  normalizeEmployeeRoleName,
  isBuiltinEmployeeRole,
  ROLE_DASHBOARD_HOME_OPTIONS,
  getDefaultModuleKeysForDashboardPath,
  stripCustomRoleDefaultModules,
} from "@/lib/employeeRoles";
import { syncRoleDashboardOverridesFile } from "@/lib/syncRoleDashboardOverrides";
import { getRoleDefaultModuleKeys } from "@/lib/roleDefaultModuleAccess";
import {
  ALL_MODULE_KEYS,
  parseStoredModuleAccess,
} from "@/lib/moduleAccess";

const VALID_DASHBOARD_PATHS = new Set(
  ROLE_DASHBOARD_HOME_OPTIONS.map((o) => o.value),
);

function mapRoleRow(r) {
  return {
    id: r.id,
    roleName: r.role_name,
    dashboardPath: r.dashboard_path,
    isBuiltin: Number(r.is_builtin) === 1,
    createdAt: r.created_at,
  };
}

export async function listEmployeeRolesFromDb(db) {
  await ensureCrmEmployeeRolesTable(db);
  const [rows] = await db.query(
    `SELECT id, role_name, dashboard_path, is_builtin, created_at
     FROM crm_employee_roles
     ORDER BY is_builtin DESC, role_name ASC`,
  );
  return rows;
}

export async function listCustomEmployeeRoles(db) {
  await ensureCrmEmployeeRolesTable(db);
  const [rows] = await db.query(
    `SELECT id, role_name, dashboard_path, is_builtin, created_at
     FROM crm_employee_roles
     WHERE is_builtin = 0
     ORDER BY role_name ASC`,
  );
  return rows;
}

export async function listAllEmployeeRolesForUi() {
  const db = await getDbConnection();
  const rows = await listEmployeeRolesFromDb(db);
  const mapped = rows.map(mapRoleRow);
  const roles = mapped.map((r) => r.roleName);
  return {
    roles: roles.length ? roles : mergeEmployeeRoleLists(BASE_EMPLOYEE_ROLES, []),
    entries: mapped,
    custom: mapped.filter((r) => !r.isBuiltin),
    dashboardOptions: ROLE_DASHBOARD_HOME_OPTIONS,
  };
}

export async function refreshRoleDashboardOverridesFromDb() {
  const db = await getDbConnection();
  const rows = await listCustomEmployeeRoles(db);
  return syncRoleDashboardOverridesFile(rows);
}

export async function createCustomEmployeeRole({ roleName, dashboardPath }) {
  const name = normalizeEmployeeRoleName(roleName);
  if (!name) {
    throw new Error("Role name is required.");
  }
  if (name === "SUPERADMIN") {
    throw new Error("SUPERADMIN cannot be created.");
  }
  if (isBuiltinEmployeeRole(name)) {
    throw new Error("This role already exists as a built-in role.");
  }
  const dash = String(dashboardPath || "/user-dashboard").trim();
  if (!VALID_DASHBOARD_PATHS.has(dash)) {
    throw new Error("Invalid dashboard home.");
  }

  const db = await getDbConnection();
  await ensureCrmEmployeeRolesTable(db);

  const [existing] = await db.query(
    `SELECT id, is_builtin FROM crm_employee_roles WHERE role_name = ? LIMIT 1`,
    [name],
  );
  if (existing.length) {
    throw new Error("Role already exists.");
  }

  const moduleDefaults = filterKnownModuleKeys(
    getDefaultModuleKeysForDashboardPath(dash, { forNewCustomRole: true }),
  );
  await db.query(
    `INSERT INTO crm_employee_roles (role_name, dashboard_path, is_builtin, default_module_access)
     VALUES (?, ?, 0, ?)`,
    [name, dash, JSON.stringify(moduleDefaults)],
  );

  await refreshRoleDashboardOverridesFromDb();
  return { roleName: name, dashboardPath: dash };
}

/**
 * Returns canonical role_name from crm_employee_roles if allowed, else null.
 */
function filterKnownModuleKeys(keys) {
  const known = new Set(ALL_MODULE_KEYS);
  return [...new Set((keys || []).map((k) => String(k || "").trim()).filter(Boolean))].filter(
    (k) => known.has(k),
  );
}

/** Role preset for Global Module Access UI (DB override, else code defaults). */
export async function getRoleDefaultModulesForBulkUi(db, roleName) {
  const key = normalizeEmployeeRoleName(roleName);
  if (!key) return [];
  await ensureCrmEmployeeRolesTable(db);
  const [rows] = await db.query(
    `SELECT default_module_access, dashboard_path, is_builtin FROM crm_employee_roles
     WHERE UPPER(TRIM(role_name)) = ?
     LIMIT 1`,
    [key],
  );
  const isCustomRole = Number(rows[0]?.is_builtin) === 0;
  const raw = rows[0]?.default_module_access;
  if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
    const parsed = parseStoredModuleAccess(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return filterKnownModuleKeys(parsed);
    }
  }
  const dash = String(rows[0]?.dashboard_path || "").trim();
  if (dash) {
    const fromDashboard = filterKnownModuleKeys(
      getDefaultModuleKeysForDashboardPath(dash, { forNewCustomRole: isCustomRole }),
    );
    if (fromDashboard.length > 0) return fromDashboard;
  }
  let keys = filterKnownModuleKeys(getRoleDefaultModuleKeys(key));
  if (isCustomRole) keys = stripCustomRoleDefaultModules(keys);
  return keys;
}

export async function saveRoleDefaultModulesForBulkUi(db, roleName, moduleKeys) {
  const key = normalizeEmployeeRoleName(roleName);
  if (!key) return;
  await ensureCrmEmployeeRolesTable(db);
  const keys = filterKnownModuleKeys(moduleKeys);
  await db.query(
    `UPDATE crm_employee_roles SET default_module_access = ? WHERE UPPER(TRIM(role_name)) = ?`,
    [JSON.stringify(keys), key],
  );
}

export async function resolveAllowedEmployeeRole(roleName) {
  const key = normalizeEmployeeRoleName(roleName);
  if (!key || key === "SUPERADMIN") return null;

  const db = await getDbConnection();
  await ensureCrmEmployeeRolesTable(db);

  const [rows] = await db.query(
    `SELECT role_name FROM crm_employee_roles
     WHERE UPPER(TRIM(role_name)) = ?
     LIMIT 1`,
    [key],
  );
  if (rows.length) {
    return String(rows[0].role_name).trim();
  }

  if (isBuiltinEmployeeRole(key)) {
    return key;
  }
  return null;
}

export async function deleteCustomEmployeeRole(id) {
  const db = await getDbConnection();
  await ensureCrmEmployeeRolesTable(db);

  const [rows] = await db.query(
    `SELECT id, role_name, is_builtin FROM crm_employee_roles WHERE id = ? LIMIT 1`,
    [id],
  );
  if (!rows.length) {
    throw new Error("Role not found.");
  }
  if (Number(rows[0].is_builtin) === 1) {
    throw new Error("Built-in roles cannot be deleted.");
  }
  const roleName = rows[0].role_name;

  const [used] = await db.query(
    `SELECT COUNT(*) AS c FROM rep_list WHERE UPPER(TRIM(userRole)) = ?`,
    [normalizeEmployeeRoleName(roleName)],
  );
  if (Number(used[0]?.c || 0) > 0) {
    throw new Error("Cannot delete: employees are assigned this role.");
  }

  await db.query(`DELETE FROM crm_employee_roles WHERE id = ?`, [id]);
  await refreshRoleDashboardOverridesFromDb();
  return { roleName };
}
