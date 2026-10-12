import { getDbConnection } from "@/lib/db";

export function normalizeWarrantyFlag(value) {
  const flag = String(value ?? "").trim().toUpperCase();
  if (flag === "Y" || flag === "YES" || flag === "1") return "Y";
  if (flag === "N" || flag === "NO" || flag === "0") return "N";
  return null;
}

export async function ensureCoveredInWarrantyColumn(conn = null) {
  const db = conn || (await getDbConnection());
  const [cols] = await db.execute(
    `SELECT IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'spare_list'
       AND COLUMN_NAME = 'covered_in_warranty'`,
  );
  if (cols.length === 0) {
    await db.execute(
      `ALTER TABLE spare_list
       ADD COLUMN covered_in_warranty CHAR(1) NULL DEFAULT NULL
       COMMENT 'Y = covered in warranty, N = not covered, NULL = not selected'`,
    );
    return db;
  }
  if (String(cols[0].IS_NULLABLE).toUpperCase() === "NO") {
    await db.execute(
      `ALTER TABLE spare_list
       MODIFY COLUMN covered_in_warranty CHAR(1) NULL DEFAULT NULL
       COMMENT 'Y = covered in warranty, N = not covered, NULL = not selected'`,
    );
    await db.execute(
      `UPDATE spare_list SET covered_in_warranty = NULL WHERE covered_in_warranty = 'N'`,
    );
  }
  return db;
}

export async function ensureHsnSacColumn(conn = null) {
  const db = conn || (await getDbConnection());
  const [cols] = await db.execute(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'spare_list'
       AND COLUMN_NAME = 'hsn_sac'`,
  );
  if (cols.length === 0) {
    await db.execute(
      `ALTER TABLE spare_list
       ADD COLUMN hsn_sac VARCHAR(32) NULL DEFAULT NULL
       COMMENT 'HSN/SAC code for GST'`,
    );
  }
  return db;
}
