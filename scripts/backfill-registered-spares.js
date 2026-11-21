/**
 * Copy already-registered spare rows from warranty_products into registered_spares.
 * Run: npm run backfill:registered-spares
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function trimEq(a, b) {
  return `TRIM(CONVERT(${a} USING utf8mb4)) = TRIM(CONVERT(${b} USING utf8mb4))`;
}
function trimUtf8(expr) {
  return `TRIM(CONVERT(${expr} USING utf8mb4))`;
}

function loadEnv() {
  for (const n of [".env.local", ".env"]) {
    const f = path.join(process.cwd(), n);
    if (!fs.existsSync(f)) continue;
    for (const ln of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
      const t = ln.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
    return;
  }
}

async function columnExists(conn, name) {
  const [rows] = await conn.execute(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'warranty_products' AND COLUMN_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

async function main() {
  loadEnv();
  const { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
  if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.error("Missing DB_HOST, DB_USER, or DB_NAME in .env.local");
    process.exit(1);
  }

  const createSql = fs.readFileSync(
    path.join(process.cwd(), "migrations/create_registered_spares_table.sql"),
    "utf8"
  );

  const conn = await mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD ?? "",
    database: DB_NAME,
    dateStrings: true,
  });

  await conn.query(createSql.trim());

  const hasInstalledBy = await columnExists(conn, "installed_by");
  const hasSpareStatus = await columnExists(conn, "spare_installation_status");

  const installedBySpare = hasInstalledBy
    ? `(wp.installed_by IS NOT NULL AND TRIM(wp.installed_by) <> '')`
    : "0";

  const spareSerialsSub = `
    SELECT DISTINCT ${trimUtf8("d.serial_no")} AS spare_serial
    FROM dispatch d
    INNER JOIN spare_list sl ON ${trimEq("sl.spare_number", "d.item_code")}
    WHERE d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> ''
  `;

  const notMainProduct = `NOT EXISTS (
    SELECT 1 FROM products_list pl
    WHERE ${trimEq("pl.item_code", "wp.model")}
  )`;

  const spareWhere = `(
    (${installedBySpare} OR ds.spare_serial IS NOT NULL)
    AND ${notMainProduct}
  )`;

  console.log("Removing product rows mistakenly stored in registered_spares…");
  const [delResult] = await conn.execute(`
    DELETE rs FROM registered_spares rs
    LEFT JOIN warranty_products wp ON wp.id = rs.warranty_product_id
  LEFT JOIN (${spareSerialsSub}) ds
      ON ${trimUtf8("wp.serial_number")} = ds.spare_serial
    WHERE EXISTS (
      SELECT 1 FROM products_list pl
      WHERE ${trimEq("pl.item_code", trimUtf8("COALESCE(rs.spare_item_code, rs.model, wp.model)"))}
    )
    OR (
      wp.id IS NOT NULL
      AND NOT ${spareWhere}
    )
  `);
  console.log(`Removed ${delResult.affectedRows ?? 0} non-spare row(s).`);

  console.log("Loading spare dispatch serials…");
  const [dispatchRows] = await conn.execute(`
    SELECT d.id, d.serial_no, no.order_id, no.quote_number
    FROM dispatch d
    INNER JOIN spare_list sl ON ${trimEq("sl.spare_number", "d.item_code")}
    LEFT JOIN neworder no ON ${trimEq("d.quote_number", "no.quote_number")}
    WHERE d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> ''
    ORDER BY d.id DESC
  `);
  console.log(`Dispatch spare lines: ${dispatchRows.length}`);

  const dispatchBySerial = new Map();
  for (const d of dispatchRows) {
    const key = String(d.serial_no || "").trim().toLowerCase();
    if (key && !dispatchBySerial.has(key)) dispatchBySerial.set(key, d);
  }

  console.log("Selecting warranty spare rows not yet in registered_spares…");
  const selectSql = `
    SELECT
      wp.id AS warranty_product_id,
      wp.product_name,
      wp.model,
      wp.serial_number,
      wp.customer_name,
      wp.contact_person,
      wp.contact,
      wp.email,
      wp.customer_address,
      wp.state,
      ${hasInstalledBy ? "wp.installed_by" : "NULL AS installed_by"},
      ${
        hasSpareStatus
          ? "wp.spare_installation_status"
          : "NULL AS spare_installation_status"
      },
      wp.installation_completed_by,
      wp.installation_completed_date,
      wp.invoice_number,
      wp.invoice_date,
      wp.created_by,
      wp.created_at
    FROM warranty_products wp
    LEFT JOIN registered_spares rs ON rs.warranty_product_id = wp.id
    LEFT JOIN (${spareSerialsSub}) ds
      ON ${trimUtf8("wp.serial_number")} = ds.spare_serial
    WHERE rs.id IS NULL
      AND ${spareWhere}
  `;

  const [rows] = await conn.execute(selectSql);
  console.log(`Rows to insert: ${rows.length}`);
  if (!rows.length) {
    console.log("No spare warranty rows to backfill (already synced or none found).");
    await conn.end();
    return;
  }

  const insertSql = `
    INSERT INTO registered_spares (
      warranty_product_id, dispatch_id, order_id, quote_number,
      spare_item_code, spare_item_name, serial_number,
      product_name, model, customer_name, contact_person, contact,
      email, customer_address, state,
      installed_by, spare_installation_status,
      installation_completed_by, installation_completed_date,
      invoice_number, invoice_date, created_by, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let inserted = 0;
  const batchSize = 50;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const serialKey = String(r.serial_number || "").trim().toLowerCase();
    const dispatch = serialKey ? dispatchBySerial.get(serialKey) : null;

    const spareCode = String(r.model || "").trim() || null;
    const spareName = String(r.product_name || "").trim() || null;
    await conn.execute(insertSql, [
      r.warranty_product_id,
      dispatch?.id || null,
      dispatch?.order_id ? String(dispatch.order_id).trim() : null,
      dispatch?.quote_number ? String(dispatch.quote_number).trim() : null,
      spareCode,
      spareName,
      r.serial_number ? String(r.serial_number).trim() : null,
      spareName,
      spareCode,
      r.customer_name,
      r.contact_person,
      r.contact,
      r.email,
      r.customer_address,
      r.state,
      r.installed_by,
      r.spare_installation_status,
      r.installation_completed_by,
      r.installation_completed_date,
      r.invoice_number,
      r.invoice_date,
      r.created_by,
      r.created_at,
    ]);
    inserted += 1;
    if (inserted % batchSize === 0) {
      console.log(`Inserted ${inserted}/${rows.length}…`);
    }
  }

  await conn.end();
  console.log(`Done. Backfilled ${inserted} registered spare(s) into registered_spares.`);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});