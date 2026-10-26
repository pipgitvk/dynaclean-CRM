import {
  deriveStatementInvoiceStatus,
  parseLinkedPurchaseTokens,
  parseLinkedStatementIds,
} from "@/lib/statementLinkedPurchases";

export function partyPaymentToken(partyPaymentId) {
  const id = Number(partyPaymentId);
  if (!Number.isFinite(id) || id <= 0) return "";
  return `PTY${Math.trunc(id)}`;
}

function mergeTokens(existingRaw, token) {
  const tokens = parseLinkedPurchaseTokens(existingRaw);
  if (!token) return tokens;
  if (!tokens.includes(token)) tokens.push(token);
  return tokens;
}

function removeToken(existingRaw, token) {
  const tokens = parseLinkedPurchaseTokens(existingRaw).filter((t) => t !== token);
  return tokens;
}

async function loadStatement(conn, statementId) {
  const [rows] = await conn.execute(
    `SELECT id, linked_purchase_ids, client_expense_id
     FROM statements WHERE id = ? LIMIT 1`,
    [statementId],
  );
  return rows?.[0] || null;
}

async function saveStatementTokens(conn, statementId, tokens) {
  const linkedVal = tokens.length > 0 ? JSON.stringify(tokens) : null;
  const [expRows] = await conn.execute(
    `SELECT client_expense_id FROM statements WHERE id = ? LIMIT 1`,
    [statementId],
  );
  const clientExpenseId = expRows?.[0]?.client_expense_id ?? null;
  const invoice_status = deriveStatementInvoiceStatus(linkedVal, clientExpenseId);
  await conn.execute(
    `UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?`,
    [linkedVal, invoice_status, statementId],
  );
}

export async function linkStatementToPartyPayment(conn, statementId, partyPaymentId) {
  const token = partyPaymentToken(partyPaymentId);
  if (!token) return;
  const stmt = await loadStatement(conn, statementId);
  if (!stmt) return;
  const tokens = mergeTokens(stmt.linked_purchase_ids, token);
  await saveStatementTokens(conn, statementId, tokens);
}

export async function unlinkStatementFromPartyPayment(conn, statementId, partyPaymentId) {
  const token = partyPaymentToken(partyPaymentId);
  if (!token) return;
  const stmt = await loadStatement(conn, statementId);
  if (!stmt) return;
  const tokens = removeToken(stmt.linked_purchase_ids, token);
  await saveStatementTokens(conn, statementId, tokens);
}

export async function syncPartyPaymentStatementLinks(
  conn,
  partyPaymentId,
  nextStatementIds,
  previousStatementIds = [],
) {
  const next = new Set(
    (nextStatementIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );
  const prev = new Set(
    (previousStatementIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0),
  );

  for (const id of prev) {
    if (!next.has(id)) {
      await unlinkStatementFromPartyPayment(conn, id, partyPaymentId);
    }
  }
  for (const id of next) {
    if (!prev.has(id)) {
      await linkStatementToPartyPayment(conn, id, partyPaymentId);
    }
  }
}

export function parsePartyPaymentLinkedStatementIds(raw) {
  return parseLinkedStatementIds(raw).map((id) => Number(id)).filter((id) => id > 0);
}

export async function unlinkAllStatementsForPartyPayment(conn, partyPaymentId) {
  const [rows] = await conn.execute(
    `SELECT linked_statement_ids FROM party_payments WHERE id = ? LIMIT 1`,
    [partyPaymentId],
  );
  const ids = parsePartyPaymentLinkedStatementIds(rows?.[0]?.linked_statement_ids);
  for (const sid of ids) {
    await unlinkStatementFromPartyPayment(conn, sid, partyPaymentId);
  }
}

export async function sumStatementCreditAmounts(conn, statementIds) {
  const ids = (statementIds || [])
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return { total: 0, latestDate: null };
  const placeholders = ids.map(() => "?").join(", ");
  const [rows] = await conn.execute(
    `SELECT id, amount, date FROM statements WHERE id IN (${placeholders})`,
    ids,
  );
  let total = 0;
  let latestDate = null;
  for (const row of rows || []) {
    total += Math.abs(Number(row.amount) || 0);
    const d = row.date ? String(row.date).slice(0, 10) : null;
    if (d && (!latestDate || d > latestDate)) latestDate = d;
  }
  return { total: Number(total.toFixed(2)), latestDate };
}
