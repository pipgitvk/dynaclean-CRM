-- Dedicated roles master table (built-in + custom).
-- Employee assignments stay on rep_list.userRole (role name text).
CREATE TABLE IF NOT EXISTS `crm_employee_roles` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role_name`       VARCHAR(128) NOT NULL,
  `dashboard_path`  VARCHAR(128) NOT NULL DEFAULT '/user-dashboard',
  `is_builtin`      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = system role, not deletable',
  `default_module_access` TEXT NULL DEFAULT NULL COMMENT 'Global Module Access preset for role',
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP    NULL     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_crm_employee_roles_name` (`role_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
