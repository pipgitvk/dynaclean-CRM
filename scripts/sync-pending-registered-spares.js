/**
 * Copy open (not warranty-registered) spare dispatches into registered_spares.
 * Run: npm run sync:pending-registered-spares
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function trimEq(a, b) {
  return `TRIM(CONVERT(${a} USING utf8mb4)) = TRIM(CONVERT(${b} USING utf8mb4))`;
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
      if (process.env[k] === undefined) process.env[k] = v.replace(/^['"]|['"]$/g, "");
    }
    return;
  }
}

const PENDING_NO = `
  COALESCE(no.installation_status, 0) = 0
  AND (no.is_returned = 0 OR no.is_returned = 2 OR no.is_returned IS NULL)
  AND (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
  AND no.delivery_date IS NOT NULL
  AND (
    COALESCE(no.dispatch_status, 0) = 1
    OR (
      COALESCE(no.delivery_status, 0) IN (1, 2)
      AND EXISTS (
        SELECT 1 FROM dispatch d_elig
        WHERE ${trimEq("d_elig.quote_number", "no.quote_number")}
          AND COALESCE(d_elig.stock_deducted, 0) = 1
          AND d_elig.serial_no IS NOT NULL
          AND TRIM(CONVERT(d_elig.serial_no USING utf8mb4)) <> ''
      )
    )
  )
`;

loadEnv();

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME,
  });

  const createSql = fs.readFileSync(
    path.join(process.cwd(), "migrations/create_registered_spares_table.sql"),
    "utf8",
  );
  await conn.query(createSql.trim());

  const baseFrom = `
    FROM neworder no
    INNER JOIN dispatch d ON ${trimEq("d.quote_number", "no.quote_number")}
    INNER JOIN spare_list sl ON ${trimEq("sl.spare_number", "d.item_code")}
    LEFT JOIN warranty_products wp
      ON ${trimEq("wp.serial_number", "d.serial_no")}
      AND d.serial_no IS NOT NULL AND TRIM(d.serial_no) <> ''
  `;

  const [ins] = await conn.execute(`
    INSERT INTO registered_spares (
      dispatch_id, order_id, quote_number,
      spare_item_code, spare_item_name, serial_number,
      product_name, model,
      customer_name, contact_person, contact,
      invoice_number, spare_installation_status, created_by
    )
    SELECT
      d.id, no.order_id, no.quote_number,
      d.item_code, d.item_name, NULLIF(TRIM(d.serial_no), ''),
      d.item_name, d.item_code,
      no.company_name, NULLIF(TRIM(no.client_name), ''), no.contact,
      no.invoice_number, 'pending', 'pending-pipeline'
    ${baseFrom}
    LEFT JOIN registered_spares rs_existing ON rs_existing.dispatch_id = d.id
    WHERE ${PENDING_NO}
      AND NOT EXISTS (
        SELECT 1 FROM products_list pl WHERE ${trimEq("pl.item_code", "d.item_code")}
      )
      AND rs_existing.id IS NULL
      AND wp.id IS NULL
  `);

  const [upd] = await conn.execute(`
    UPDATE registered_spares rs
    INNER JOIN dispatch d ON d.id = rs.dispatch_id
    INNER JOIN neworder no ON ${trimEq("d.quote_number", "no.quote_number")}
    SET
      rs.order_id = no.order_id,
      rs.quote_number = no.quote_number,
      rs.spare_item_code = d.item_code,
      rs.spare_item_name = d.item_name,
      rs.product_name = d.item_name,
      rs.model = d.item_code,
      rs.serial_number = NULLIF(TRIM(d.serial_no), ''),
      rs.customer_name = no.company_name,
      rs.contact_person = NULLIF(TRIM(no.client_name), ''),
      rs.contact = no.contact,
      rs.invoice_number = no.invoice_number,
      rs.updated_at = NOW()
    WHERE rs.warranty_product_id IS NULL
      AND (rs.created_by = 'pending-pipeline' OR rs.spare_installation_status = 'pending')
  `);

  await conn.end();
  console.log(
    `Done. Inserted ${ins?.affectedRows ?? 0} pending spare row(s), refreshed ${upd?.affectedRows ?? 0}.`,
  );
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});