/**
 * Fill neworder.invoice_number from invoices.buyers_order_no (tax invoices only).
 * Usage: node scripts/backfill-neworder-invoice-from-invoices.js
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  // Production uses invoices.type (not invoice_type).
  const [result] = await conn.execute(`
    UPDATE neworder no
    INNER JOIN invoices inv
      ON CAST(no.order_id AS CHAR) = TRIM(inv.buyers_order_no)
      AND inv.invoice_number IS NOT NULL AND TRIM(inv.invoice_number) <> ''
      AND (inv.type IS NULL OR LOWER(TRIM(inv.type)) <> 'performa')
      AND (inv.status IS NULL OR UPPER(TRIM(inv.status)) <> 'CANCELLED')
    SET no.invoice_number = inv.invoice_number
    WHERE no.invoice_number IS NULL OR TRIM(no.invoice_number) = ''
  `);

  console.log("Rows updated:", result.affectedRows ?? 0);
  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
