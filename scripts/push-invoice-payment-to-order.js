/**
 * One-shot: copy invoices.amount_paid + linked_trans_ids → neworder.
 *
 * Usage:
 *   node scripts/push-invoice-payment-to-order.js DYN/2026-27/344
 *   node scripts/push-invoice-payment-to-order.js --all
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

function parseLinkedTransIds(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch (_) {}
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function pushOne(conn, inv) {
  const invoiceNumber = String(inv.invoice_number || "").trim();
  const buyersOrder = String(inv.buyers_order_no || "").trim();
  const amountPaid = Number(inv.amount_paid) || 0;
  const tids = parseLinkedTransIds(inv.linked_trans_ids);

  if (amountPaid <= 0 && !tids.length) {
    console.log("Skip (no paid/link):", invoiceNumber);
    return;
  }

  const paymentId = tids.length ? tids.join(",") : null;
  const paymentsJson = JSON.stringify(
    tids.length
      ? tids.map((tid) => ({
          statement_id: null,
          trans_id: tid,
          date: null,
          amount: tids.length === 1 ? amountPaid : amountPaid / tids.length,
        }))
      : [{ statement_id: null, trans_id: "", date: null, amount: amountPaid }],
  );

  const params = [
    invoiceNumber || null,
    amountPaid,
    paymentsJson,
    paymentId,
    String(amountPaid),
    amountPaid > 0 ? "partially paid" : "pending",
  ];
  const where = [];
  if (buyersOrder) {
    where.push("CAST(order_id AS CHAR) = ?");
    params.push(buyersOrder);
  }
  if (invoiceNumber) {
    where.push("TRIM(invoice_number) = ?");
    params.push(invoiceNumber);
  }
  if (!where.length) {
    console.log("Skip (no order match):", invoiceNumber);
    return;
  }

  const [result] = await conn.execute(
    `UPDATE neworder SET
      invoice_number = COALESCE(NULLIF(TRIM(invoice_number), ''), ?),
      amount_received = ?,
      linked_payments_json = ?,
      payment_id = ?,
      payment_amount = ?,
      payment_status = ?
     WHERE ${where.join(" OR ")}`,
    params,
  );
  console.log(
    "Updated",
    invoiceNumber,
    "→ order",
    buyersOrder || "(by invoice_number)",
    "amount",
    amountPaid,
    "rows",
    result.affectedRows,
  );
}

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "Usage: node scripts/push-invoice-payment-to-order.js <invoice_number|--all>",
    );
    process.exit(1);
  }

  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  for (const sql of [
    "ALTER TABLE neworder ADD COLUMN amount_received DECIMAL(15,2) NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN payment_received_date DATE NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN linked_payments_json TEXT NULL DEFAULT NULL",
    "ALTER TABLE neworder ADD COLUMN invoice_number VARCHAR(100) NULL DEFAULT NULL",
  ]) {
    try {
      await conn.execute(sql);
    } catch (_) {}
  }

  let rows;
  if (arg === "--all") {
    [rows] = await conn.execute(
      `SELECT invoice_number, buyers_order_no, amount_paid, linked_trans_ids
       FROM invoices
       WHERE amount_paid > 0
         AND (type IS NULL OR LOWER(TRIM(type)) <> 'performa')
         AND (status IS NULL OR UPPER(TRIM(status)) <> 'CANCELLED')`,
    );
  } else {
    [rows] = await conn.execute(
      `SELECT invoice_number, buyers_order_no, amount_paid, linked_trans_ids
       FROM invoices WHERE TRIM(invoice_number) = TRIM(?) LIMIT 1`,
      [arg],
    );
  }

  if (!rows?.length) {
    console.log("No invoice found.");
  } else {
    for (const inv of rows) await pushOne(conn, inv);
  }

  await conn.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
