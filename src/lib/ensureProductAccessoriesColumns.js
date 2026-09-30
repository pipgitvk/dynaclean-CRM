export async function ensureProductAccessoriesColumns(conn) {
  try {
    const [spareCol] = await conn.execute(
      `SHOW COLUMNS FROM product_accessories LIKE 'spare_id'`,
    );
    if (!spareCol.length) {
      await conn.execute(
        `ALTER TABLE product_accessories
         ADD COLUMN spare_id INT DEFAULT NULL COMMENT 'FK to spare_list.id' AFTER product_code`,
      );
    }
  } catch (e) {
    console.error("ensureProductAccessoriesColumns spare_id:", e?.message);
  }

  try {
    const [statusCol] = await conn.execute(
      `SHOW COLUMNS FROM product_accessories LIKE 'package_status'`,
    );
    if (!statusCol.length) {
      await conn.execute(
        `ALTER TABLE product_accessories
         ADD COLUMN package_status ENUM('available', 'added') NOT NULL DEFAULT 'available'
         COMMENT 'available=in package checklist, added=separate dispatch row' AFTER qty`,
      );
    }
  } catch (e) {
    console.error("ensureProductAccessoriesColumns package_status:", e?.message);
  }

  try {
    await conn.execute(
      `ALTER TABLE product_accessories ADD KEY idx_spare_id (spare_id)`,
    );
  } catch {
    // index may already exist
  }
}
