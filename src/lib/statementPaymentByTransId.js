import { parseOrderLinkedPayments } from "@/lib/orderLinkedPaymentsDisplay";
import { sqlUtf8TrimExpr } from "@/lib/sqlUtf8Compare";

function splitCsv(value) {
  return (value ?? "")
    .toString()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** All UTR / trans_id tokens referenced on an order row. */
export function collectOrderPaymentTransIds(order) {
  const set = new Set();
  for (const id of splitCsv(order?.payment_id)) set.add(id);
  for (const id of splitCsv(order?.transaction_id)) set.add(id);
  for (const p of parseOrderLinkedPayments(order || {})) {
    const tid = String(p?.trans_id ?? "").trim();
    if (tid) set.add(tid);
  }
  return [...set];
}

/**
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {string[]} transIds
 */
export async function fetchStatementRowsByTransIds(conn, transIds) {
  const ids = [...new Set(transIds.map((t) => String(t).trim()).filter(Boolean))];
  if (!ids.length) return [];

  const [rows] = await conn.execute(
    `SELECT id, trans_id, date, amount
     FROM statements
     WHERE ${sqlUtf8TrimExpr("trans_id")} IN (${ids.map(() => "TRIM(?)").join(",")})`,
    ids,
  );
  return rows || [];
}

function formatStatementDate(dateVal) {
  if (!dateVal) return null;
  const s = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Latest statement row per trans_id (by statements.id). */
export function indexStatementPaymentsByTransId(statementRows) {
  const byTrans = new Map();
  for (const row of statementRows || []) {
    const tid = String(row.trans_id ?? "").trim();
    if (!tid) continue;
    const key = tid.toLowerCase();
    const prev = byTrans.get(key);
    if (prev && Number(row.id) <= Number(prev.statement_id)) continue;
    byTrans.set(key, {
      trans_id: tid,
      amount: Math.abs(Number(row.amount) || 0),
      date: formatStatementDate(row.date),
      statement_id: row.id,
    });
  }
  return byTrans;
}

/**
 * Attach `statement_payments_by_trans_id` for payment history / list UI.
 * Amounts come from `statements.amount` for each order trans_id.
 */
export async function attachStatementPaymentsToOrders(conn, orders) {
  if (!Array.isArray(orders) || !orders.length) return orders;

  const allIds = new Set();
  for (const order of orders) {
    for (const id of collectOrderPaymentTransIds(order)) allIds.add(id);
  }
  if (!allIds.size) return orders;

  const statementRows = await fetchStatementRowsByTransIds(conn, [...allIds]);
  const byTrans = indexStatementPaymentsByTransId(statementRows);

  return orders.map((order) => {
    const statement_payments_by_trans_id = {};
    for (const id of collectOrderPaymentTransIds(order)) {
      const hit = byTrans.get(id.toLowerCase());
      if (hit && hit.amount > 0) {
        statement_payments_by_trans_id[hit.trans_id] = hit;
      }
    }
    return Object.keys(statement_payments_by_trans_id).length
      ? { ...order, statement_payments_by_trans_id }
      : order;
  });
}
