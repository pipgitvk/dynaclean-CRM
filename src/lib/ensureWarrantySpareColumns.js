async function warrantyColumnExists(conn, columnName) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'warranty_products'
       AND COLUMN_NAME = ?`,
    [columnName],
  );
  return rows.length > 0;
}

/** Fast read — no DDL (safe on list APIs). */
export async function getWarrantySpareColumnFlags(conn) {
  const [rows] = await conn.execute(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'warranty_products'
       AND COLUMN_NAME IN (
         'installed_by',
         'installation_completed_by',
         'spare_installation_status'
       )`,
  );
  const names = new Set(rows.map((r) => r.COLUMN_NAME));
  return {
    hasInstalledBy: names.has("installed_by"),
    hasSpareStatus: names.has("spare_installation_status"),
  };
}

let migrateAttempted = false;

/** DDL only when registering a spare (not on heavy list GET). */
export async function ensureWarrantySpareColumns(conn) {
  if (migrateAttempted) {
    return getWarrantySpareColumnFlags(conn);
  }
  migrateAttempted = true;

  if (!(await warrantyColumnExists(conn, "installed_by"))) {
    try {
      await conn.execute(
        `ALTER TABLE warranty_products
         ADD COLUMN installed_by VARCHAR(64) NULL DEFAULT NULL
         AFTER contact_person`,
      );
    } catch (e) {
      console.error("ensureWarrantySpareColumns installed_by:", e?.message || e);
    }
  }

  if (!(await warrantyColumnExists(conn, "installation_completed_by"))) {
    try {
      await conn.execute(
        `ALTER TABLE warranty_products
         ADD COLUMN installation_completed_by VARCHAR(120) NULL DEFAULT NULL
         AFTER installed_by`,
      );
      await conn.execute(
        `ALTER TABLE warranty_products
         ADD COLUMN installation_completed_date DATE NULL DEFAULT NULL
         AFTER installation_completed_by`,
      );
    } catch (e) {
      console.error(
        "ensureWarrantySpareColumns installation_completed_*:",
        e?.message || e,
      );
    }
  }

  if (!(await warrantyColumnExists(conn, "spare_installation_status"))) {
    try {
      if (await warrantyColumnExists(conn, "installation_completed_date")) {
        await conn.execute(
          `ALTER TABLE warranty_products
           ADD COLUMN spare_installation_status VARCHAR(32) NULL DEFAULT NULL
           COMMENT 'completed | pending (spare registrations only)'
           AFTER installation_completed_date`,
        );
      } else {
        await conn.execute(
          `ALTER TABLE warranty_products
           ADD COLUMN spare_installation_status VARCHAR(32) NULL DEFAULT NULL
           COMMENT 'completed | pending (spare registrations only)'
           AFTER contact_person`,
        );
      }
    } catch (e) {
      console.error(
        "ensureWarrantySpareColumns spare_installation_status:",
        e?.message || e,
      );
    }
  }

  return getWarrantySpareColumnFlags(conn);
}