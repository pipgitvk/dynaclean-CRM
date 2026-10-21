import { BASE_EMPLOYEE_ROLES } from "@/lib/employeeRoles";
import { getRoleDashboardPath } from "@/lib/getRoleDashboardPath";

let _ensured = false;

async function ensureDefaultModuleAccessColumn(db) {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'crm_employee_roles'
       AND COLUMN_NAME = 'default_module_access'`,
  );
  if (cols.length === 0) {
    await db.query(
      `ALTER TABLE crm_employee_roles
       ADD COLUMN default_module_access TEXT NULL DEFAULT NULL
       COMMENT 'Global Module Access preset for this role' AFTER is_builtin`,
    );
  }
}

async function ensureIsBuiltinColumn(db) {
  const [cols] = await db.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'crm_employee_roles'
       AND COLUMN_NAME = 'is_builtin'`,
  );
  if (cols.length === 0) {
    await db.query(
      `ALTER TABLE crm_employee_roles
       ADD COLUMN is_builtin TINYINT(1) NOT NULL DEFAULT 0
       COMMENT '1 = system role, not deletable' AFTER dashboard_path`,
    );
  }
}

async function seedBuiltinEmployeeRoles(db) {
  for (const role of BASE_EMPLOYEE_ROLES) {
    const name = String(role || "").trim();
    if (!name) continue;
    const dashboardPath = getRoleDashboardPath(name);
    await db.query(
      `INSERT INTO crm_employee_roles (role_name, dashboard_path, is_builtin)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE
         dashboard_path = IF(is_builtin = 1, VALUES(dashboard_path), dashboard_path),
         is_builtin = IF(is_builtin = 1, 1, is_builtin)`,
      [name, dashboardPath],
    );
  }
}

export async function ensureCrmEmployeeRolesTable(db) {
  if (_ensured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS crm_employee_roles (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_name VARCHAR(128) NOT NULL,
      dashboard_path VARCHAR(128) NOT NULL DEFAULT '/user-dashboard',
      is_builtin TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_crm_employee_roles_name (role_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureIsBuiltinColumn(db);
  await ensureDefaultModuleAccessColumn(db);
  await seedBuiltinEmployeeRoles(db);
  _ensured = true;
}
