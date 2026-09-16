const mysql = require("mysql2/promise");
require("dotenv").config();

function parseSpareNumberFromAccessoryName(name) {
  const match = String(name || "").match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : null;
}

async function resolveSpareId(connection, accessoryName, spareByNumber, spareByName) {
  const spareNumber = parseSpareNumberFromAccessoryName(accessoryName);
  if (spareNumber) {
    const byNumber = spareByNumber.get(spareNumber);
    if (byNumber) return { id: byNumber, method: "spare_number" };
  }

  const cleanName = String(accessoryName || "")
    .replace(/\([^)]*\)\s*$/, "")
    .trim()
    .toLowerCase();
  if (cleanName && spareByName.has(cleanName)) {
    return { id: spareByName.get(cleanName), method: "item_name" };
  }

  const fullName = String(accessoryName || "").trim().toLowerCase();
  if (fullName && spareByName.has(fullName)) {
    return { id: spareByName.get(fullName), method: "full_name" };
  }

  return null;
}

async function runBackfill() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS || process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    const [columnCheck] = await connection.execute(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'product_accessories'
        AND COLUMN_NAME = 'spare_id'
    `);

    if (columnCheck.length === 0) {
      throw new Error(
        "Column spare_id not found. Run run_migration.js first (add_spare_id_package_status_to_product_accessories).",
      );
    }

    const [spares] = await connection.execute(
      `SELECT id, spare_number, item_name FROM spare_list`,
    );

    const spareByNumber = new Map();
    const spareByName = new Map();

    for (const spare of spares) {
      if (spare.spare_number != null) {
        spareByNumber.set(String(spare.spare_number).trim(), spare.id);
      }
      spareByNumber.set(String(spare.id).trim(), spare.id);

      const nameKey = String(spare.item_name || "")
        .trim()
        .toLowerCase();
      if (nameKey && !spareByName.has(nameKey)) {
        spareByName.set(nameKey, spare.id);
      }
    }

    const [accessories] = await connection.execute(
      `SELECT id, product_code, accessory_name, spare_id
       FROM product_accessories
       WHERE spare_id IS NULL
       ORDER BY product_code, accessory_name`,
    );

    console.log(`Found ${accessories.length} product_accessories row(s) without spare_id`);

    let updated = 0;
    const unmatched = [];

    for (const row of accessories) {
      const match = await resolveSpareId(
        connection,
        row.accessory_name,
        spareByNumber,
        spareByName,
      );

      if (!match) {
        unmatched.push(row);
        continue;
      }

      await connection.execute(
        `UPDATE product_accessories SET spare_id = ? WHERE id = ? AND spare_id IS NULL`,
        [match.id, row.id],
      );

      updated += 1;
      console.log(
        `✓ id=${row.id} [${row.product_code}] "${row.accessory_name}" -> spare_id=${match.id} (${match.method})`,
      );
    }

    console.log("\nBackfill summary:");
    console.log(`  Updated: ${updated}`);
    console.log(`  Unmatched: ${unmatched.length}`);

    if (unmatched.length > 0) {
      console.log("\nUnmatched rows (fix manually in Product Accessories):");
      for (const row of unmatched) {
        console.log(
          `  - id=${row.id} product=${row.product_code} name="${row.accessory_name}"`,
        );
      }
    }

    console.log("\nBackfill completed.");
  } catch (error) {
    console.error("Backfill failed:", error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runBackfill();
