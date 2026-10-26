import { getDbConnection } from "@/lib/db";
import { ensurePartyPaymentsTable } from "@/lib/ensurePartyPaymentsTable";
import { parsePartyPaymentLinkedStatementIds } from "@/lib/partyPaymentStatementLink";
import {
  isCreditStatement,
  isDebitStatement,
} from "@/lib/isStatementSettled";
import { normalizePartyPaymentAmounts } from "@/lib/partyPaymentsCompute";
const CREATE_HISTORY = `
CREATE TABLE IF NOT EXISTS party_payment_history (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_payment_id   BIGINT UNSIGNED NOT NULL,
  customer_id        VARCHAR(32)     NULL,
  customer_name      VARCHAR(255)    NULL,
  company_name       VARCHAR(255)    NULL,
  entry_type         VARCHAR(8)      NOT NULL,
  amount             DECIMAL(18,2)   NOT NULL DEFAULT 0.00,
  order_id           VARCHAR(32)     NULL,
  invoice_number     VARCHAR(128)    NULL,
  statement_id       BIGINT UNSIGNED NULL,
  trans_id           VARCHAR(64)     NULL,
  entry_date         DATE            NULL,
  created_by         VARCHAR(100)    NULL,
  created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pph_party (party_payment_id),
  KEY idx_pph_order (order_id),
  KEY idx_pph_invoice (invoice_number),
  UNIQUE KEY uniq_pph_in_stmt (party_payment_id, entry_type, statement_id),
  UNIQUE KEY uniq_pph_out_order (party_payment_id, entry_type, order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

let historyEnsured = false;

async function ensureHistoryExtraColumns(db) {
  const alters = [
    ["customer_id", "VARCHAR(32) NULL AFTER party_payment_id"],
    ["customer_name", "VARCHAR(255) NULL AFTER customer_id"],
    ["company_name", "VARCHAR(255) NULL AFTER customer_name"],
    ["created_by", "VARCHAR(100) NULL AFTER entry_date"],
  ];
  for (const [col, ddl] of alters) {
    try {
      await db.execute(`SELECT ${col} FROM party_payment_history LIMIT 1`);
    } catch {
      try {
        await db.execute(
          `ALTER TABLE party_payment_history ADD COLUMN ${col} ${ddl}`,
        );
      } catch {
        /* column may already exist */
      }
    }
  }
}

async function loadPartyPaymentMeta(conn, partyPaymentId) {
  const [rows] = await conn.execute(
    `SELECT customer_id, name, company_name, created_by FROM party_payments WHERE id = ? LIMIT 1`,
    [Number(partyPaymentId)],
  );
  const row = rows?.[0];
  if (!row) {
    return {
      customer_id: null,
      customer_name: null,
      company_name: null,
      created_by: null,
    };
  }
  return {
    customer_id: row.customer_id ? String(row.customer_id).trim() : null,
    customer_name: row.name ? String(row.name).trim() : null,
    company_name: row.company_name ? String(row.company_name).trim() : null,
    created_by: row.created_by ? String(row.created_by).trim() : null,
  };
}

function resolveHistoryCreatedBy(explicit, partyMeta) {
  const fromArg = explicit ? String(explicit).trim() : "";
  if (fromArg) return fromArg;
  return partyMeta?.created_by ? String(partyMeta.created_by).trim() : null;
}

/** Latest order / invoice on parent party_payments row. */
export async function updatePartyPaymentLinkOnOut(
  conn,
  partyPaymentId,
  { orderId, invoiceNumber },
) {
  await ensurePartyPaymentsTable(conn);
  const ppId = Number(partyPaymentId);
  const oid = orderId != null ? String(orderId).trim() : "";
  if (!ppId || !oid) return;
  const linkedNum = /^\d+$/.test(oid) ? Number(oid) : null;
  await conn.execute(
    `UPDATE party_payments SET
      order_id = ?,
      invoice_number = ?,
      linked_order_id = COALESCE(?, linked_order_id)
     WHERE id = ?`,
    [oid, invoiceNumber ? String(invoiceNumber).trim() : null, linkedNum, ppId],
  );
}

export async function ensurePartyPaymentHistoryTable(conn) {
  if (historyEnsured) return;
  const db = conn || (await getDbConnection());
  await ensurePartyPaymentsTable(db);
  await db.execute(CREATE_HISTORY);
  await ensureHistoryExtraColumns(db);
  historyEnsured = true;
}

export async function recordPartyPaymentInEntry(
  conn,
  partyPaymentId,
  { statementId, transId, amount, entryDate, invoiceNumber, createdBy },
) {
  await ensurePartyPaymentHistoryTable(conn);
  const ppId = Number(partyPaymentId);
  const sid = statementId != null ? Number(statementId) : null;
  const amt = Number(amount) || 0;
  if (!ppId || amt <= 0) return;

  const meta = await loadPartyPaymentMeta(conn, ppId);
  const createdByVal = resolveHistoryCreatedBy(createdBy, meta);

  await conn.execute(
    `INSERT INTO party_payment_history
      (party_payment_id, customer_id, customer_name, company_name, entry_type, amount,
       statement_id, trans_id, invoice_number, entry_date, created_by)
     VALUES (?, ?, ?, ?, 'in', ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       amount = VALUES(amount),
       customer_id = COALESCE(VALUES(customer_id), customer_id),
       customer_name = COALESCE(VALUES(customer_name), customer_name),
       company_name = COALESCE(VALUES(company_name), company_name),
       trans_id = COALESCE(VALUES(trans_id), trans_id),
       invoice_number = COALESCE(VALUES(invoice_number), invoice_number),
       entry_date = COALESCE(VALUES(entry_date), entry_date),
       created_by = COALESCE(VALUES(created_by), created_by)`,
    [
      ppId,
      meta.customer_id,
      meta.customer_name,
      meta.company_name,
      amt,
      sid && sid > 0 ? sid : null,
      transId ? String(transId).trim() : null,
      invoiceNumber ? String(invoiceNumber).trim() : null,
      entryDate ? String(entryDate).slice(0, 10) : null,
      createdByVal,
    ],
  );
}

export async function recordPartyPaymentOutEntry(
  conn,
  partyPaymentId,
  { orderId, invoiceNumber, amount, entryDate, createdBy },
) {
  await ensurePartyPaymentHistoryTable(conn);
  const ppId = Number(partyPaymentId);
  const oid = orderId != null ? String(orderId).trim() : "";
  const amt = Number(amount) || 0;
  if (!ppId || !oid || amt <= 0) return;

  const meta = await loadPartyPaymentMeta(conn, ppId);
  const inv = invoiceNumber ? String(invoiceNumber).trim() : null;
  const createdByVal = resolveHistoryCreatedBy(createdBy, meta);

  await conn.execute(
    `INSERT INTO party_payment_history
      (party_payment_id, customer_id, customer_name, company_name, entry_type, amount,
       order_id, invoice_number, entry_date, created_by)
     VALUES (?, ?, ?, ?, 'out', ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       amount = VALUES(amount),
       customer_id = COALESCE(VALUES(customer_id), customer_id),
       customer_name = COALESCE(VALUES(customer_name), customer_name),
       company_name = COALESCE(VALUES(company_name), company_name),
       invoice_number = COALESCE(VALUES(invoice_number), invoice_number),
       entry_date = COALESCE(VALUES(entry_date), entry_date),
       created_by = COALESCE(VALUES(created_by), created_by)`,
    [
      ppId,
      meta.customer_id,
      meta.customer_name,
      meta.company_name,
      amt,
      oid,
      inv,
      entryDate ? String(entryDate).slice(0, 10) : null,
      createdByVal,
    ],
  );

  await updatePartyPaymentLinkOnOut(conn, ppId, {
    orderId: oid,
    invoiceNumber: inv,
  });
}

export async function sumPartyPaymentOutFromHistory(conn, partyPaymentId) {
  await ensurePartyPaymentHistoryTable(conn);
  const [rows] = await conn.execute(
    `SELECT COALESCE(SUM(amount), 0) AS s FROM party_payment_history
     WHERE party_payment_id = ? AND entry_type = 'out'`,
    [Number(partyPaymentId)],
  );
  return Number(rows?.[0]?.s) || 0;
}

export async function partyPaymentOutRecordedForOrder(
  conn,
  partyPaymentId,
  orderId,
) {
  await ensurePartyPaymentHistoryTable(conn);
  const [rows] = await conn.execute(
    `SELECT id FROM party_payment_history
     WHERE party_payment_id = ? AND entry_type = 'out' AND order_id = ?
     LIMIT 1`,
    [Number(partyPaymentId), String(orderId).trim()],
  );
  return Boolean(rows?.length);
}

/** Keep party_payments.amount_out in sync with history (source of truth for Out). */
export async function reconcilePartyPaymentTotalsFromHistory(conn, partyPaymentId) {
  await ensurePartyPaymentHistoryTable(conn);
  const ppId = Number(partyPaymentId);
  const [ppRows] = await conn.execute(
    `SELECT amount_in FROM party_payments WHERE id = ? LIMIT 1`,
    [ppId],
  );
  if (!ppRows?.length) return null;

  const amountIn = Number(ppRows[0].amount_in) || 0;
  const amountOut = await sumPartyPaymentOutFromHistory(conn, ppId);
  const amounts = normalizePartyPaymentAmounts({
    amount_in: amountIn,
    amount_out: amountOut,
  });

  await conn.execute(
    `UPDATE party_payments SET amount_out = ?, balance = ?, status = ? WHERE id = ?`,
    [amounts.amount_out, amounts.balance, amounts.status, ppId],
  );

  return amounts;
}

export function partyPaymentStatementOutOrderId(statementId) {
  const sid = Number(statementId);
  if (!Number.isFinite(sid) || sid <= 0) return "";
  return `STMT-${sid}`;
}

export async function syncPartyPaymentInHistoryFromStatements(
  conn,
  partyPaymentId,
  { createdBy } = {},
) {
  const ppId = Number(partyPaymentId);
  if (!ppId) return;

  const [ppRows] = await conn.execute(
    `SELECT linked_statement_ids FROM party_payments WHERE id = ? LIMIT 1`,
    [ppId],
  );
  const ids = parsePartyPaymentLinkedStatementIds(
    ppRows?.[0]?.linked_statement_ids,
  );

  if (!ids.length) {
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'in' AND statement_id IS NOT NULL`,
      [ppId],
    );
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'out' AND order_id LIKE 'STMT-%'`,
      [ppId],
    );
    await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
    return;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const [stmts] = await conn.execute(
    `SELECT id, type, trans_id, date, amount, invoice_number FROM statements WHERE id IN (${placeholders})`,
    ids,
  );

  const creditIds = new Set();
  const debitStmtOrderIds = new Set();

  for (const st of stmts || []) {
    const amt = Math.abs(Number(st.amount) || 0);
    if (amt <= 0) continue;
    const invRaw = st.invoice_number ? String(st.invoice_number).trim() : "";
    if (isCreditStatement(st)) {
      creditIds.add(Number(st.id));
      await recordPartyPaymentInEntry(conn, ppId, {
        statementId: st.id,
        transId: st.trans_id,
        amount: amt,
        entryDate: st.date,
        invoiceNumber: invRaw || null,
        createdBy,
      });
    } else if (isDebitStatement(st)) {
      const oid = partyPaymentStatementOutOrderId(st.id);
      debitStmtOrderIds.add(oid);
      await recordPartyPaymentOutEntry(conn, ppId, {
        orderId: oid,
        invoiceNumber: invRaw || null,
        amount: amt,
        entryDate: st.date,
        createdBy,
      });
    }
  }

  const creditIdList = [...creditIds];
  if (creditIdList.length) {
    const ph = creditIdList.map(() => "?").join(", ");
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'in' AND statement_id IS NOT NULL
         AND statement_id NOT IN (${ph})`,
      [ppId, ...creditIdList],
    );
  } else {
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'in' AND statement_id IS NOT NULL`,
      [ppId],
    );
  }

  const debitOrders = [...debitStmtOrderIds];
  if (debitOrders.length) {
    const ph = debitOrders.map(() => "?").join(", ");
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'out' AND order_id LIKE 'STMT-%'
         AND order_id NOT IN (${ph})`,
      [ppId, ...debitOrders],
    );
  } else {
    await conn.execute(
      `DELETE FROM party_payment_history
       WHERE party_payment_id = ? AND entry_type = 'out' AND order_id LIKE 'STMT-%'`,
      [ppId],
    );
  }

  await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
}

export async function backfillPartyPaymentHistory(conn, partyPaymentId) {
  await ensurePartyPaymentHistoryTable(conn);
  const ppId = Number(partyPaymentId);
  const [ppRows] = await conn.execute(
    `SELECT customer_id, phone, amount_in, amount_out, linked_statement_ids
     FROM party_payments WHERE id = ? LIMIT 1`,
    [ppId],
  );
  const pp = ppRows?.[0];
  if (!pp) return;

  await syncPartyPaymentInHistoryFromStatements(conn, ppId);
  await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
}

export async function getPartyPaymentHistory(conn, partyPaymentId) {
  await ensurePartyPaymentHistoryTable(conn);
  const ppId = Number(partyPaymentId);
  if (!ppId) return [];

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM party_payment_history WHERE party_payment_id = ?`,
    [ppId],
  );
  if (Number(countRows?.[0]?.c) === 0) {
    await backfillPartyPaymentHistory(conn, ppId);
  } else {
    await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
  }

  const [rows] = await conn.execute(
    `SELECT id, customer_id, customer_name, company_name, entry_type, amount,
            order_id, invoice_number, statement_id, trans_id, entry_date, created_by, created_at
     FROM party_payment_history
     WHERE party_payment_id = ?
     ORDER BY COALESCE(entry_date, DATE(created_at)), id`,
    [ppId],
  );

  return (rows || []).map((r) => ({
    id: r.id,
    customer_id: r.customer_id ? String(r.customer_id) : null,
    customer_name: r.customer_name ? String(r.customer_name) : null,
    company_name: r.company_name ? String(r.company_name) : null,
    entry_type: r.entry_type,
    amount: Number(r.amount) || 0,
    order_id: r.order_id ? String(r.order_id) : null,
    invoice_number: r.invoice_number ? String(r.invoice_number) : null,
    statement_id: r.statement_id != null ? Number(r.statement_id) : null,
    trans_id: r.trans_id ? String(r.trans_id) : null,
    entry_date: r.entry_date,
    created_by: r.created_by ? String(r.created_by) : null,
    created_at: r.created_at,
  }));
}
