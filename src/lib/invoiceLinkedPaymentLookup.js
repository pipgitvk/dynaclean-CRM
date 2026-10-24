import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";
import { linkedPaymentsToOrderPaymentCsv } from "@/lib/orderPaymentHistory";
import {
  sqlLikeUtf8Contains,
  sqlTrimUtf8Eq,
  sqlUtf8TrimExpr,
} from "@/lib/sqlUtf8Compare";

const INV_NUM_EQ = sqlTrimUtf8Eq("invoice_number");

function invoiceNumberTokens(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function statementLinksToInvoice(stmt, invoiceId, invoiceNumber) {
  const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
  const ipToken = `IP${invoiceId}`;
  if (tokens.some((t) => t === ipToken)) return true;

  const nums = invoiceNumberTokens(stmt.invoice_number);
  const target = String(invoiceNumber || "").trim();
  return target && nums.some((n) => n === target);
}

export function allocateStatementPaymentsForInvoice(statements, grandTotal) {
  const cap = Number(grandTotal) || 0;
  let totalPaid = 0;
  const sorted = [...statements].sort((a, b) => a.id - b.id);
  const payments = [];

  for (const stmt of sorted) {
    const stmtAmount = Math.abs(Number(stmt.amount || 0));
    if (stmtAmount <= 0) continue;

    let applied = stmtAmount;
    if (cap > 0) {
      if (totalPaid >= cap) break;
      const remaining = Math.max(0, cap - totalPaid);
      applied = Math.min(remaining, stmtAmount);
    }

    if (applied <= 0) continue;

    payments.push({
      statement_id: stmt.id,
      trans_id: stmt.trans_id ? String(stmt.trans_id).trim() : "",
      date: formatStatementDate(stmt.date),
      amount: applied,
    });
    totalPaid += applied;
  }

  return { total: totalPaid, payments };
}

export function sumStatementPaymentsForInvoice(statements, grandTotal) {
  return allocateStatementPaymentsForInvoice(statements, grandTotal).total;
}

function pickLatestStatement(statements) {
  if (!statements?.length) return null;
  return [...statements].sort((a, b) => b.id - a.id)[0];
}

function formatStatementDate(dateVal) {
  if (!dateVal) return null;
  const s = String(dateVal);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function statementsMatchingInvoiceNumber(statements, invoiceNumber) {
  const target = String(invoiceNumber || "").trim();
  if (!target) return [];
  return statements.filter((stmt) => {
    const nums = invoiceNumberTokens(stmt.invoice_number);
    return nums.some((n) => n === target);
  });
}

function parseLinkedTransIds(raw) {
  if (raw == null || String(raw).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) {
      return parsed.map((v) => String(v).trim()).filter(Boolean);
    }
  } catch (_) {
    /* ignore */
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeStatementsLinkedToInvoice(inv, stmtCandidates) {
  const transIds = new Set(parseLinkedTransIds(inv.linked_trans_ids));
  const byId = new Map();
  for (const stmt of stmtCandidates) {
    const tid = stmt.trans_id ? String(stmt.trans_id).trim() : "";
    const isLinked =
      statementLinksToInvoice(stmt, inv.id, inv.invoice_number) ||
      (tid && transIds.has(tid));
    if (isLinked) byId.set(stmt.id, stmt);
  }
  return [...byId.values()];
}

async function fetchStatementCandidatesForInvoice(conn, inv) {
  const ipToken = `IP${inv.id}`;
  const invoiceNumber = inv.invoice_number;
  const [baseRows] = await conn.execute(
    `SELECT id, trans_id, date, amount, linked_purchase_ids, invoice_number
     FROM statements
     WHERE ${sqlLikeUtf8Contains("linked_purchase_ids")}
        OR (CHAR_LENGTH(TRIM(COALESCE(invoice_number, ''))) > 0 AND ${sqlLikeUtf8Contains("invoice_number")})`,
    [ipToken, invoiceNumber],
  );

  const byId = new Map();
  for (const row of baseRows || []) byId.set(row.id, row);

  const transIds = parseLinkedTransIds(inv.linked_trans_ids);
  if (transIds.length) {
    const [transRows] = await conn.execute(
      `SELECT id, trans_id, date, amount, linked_purchase_ids, invoice_number
       FROM statements WHERE ${sqlUtf8TrimExpr("trans_id")} IN (${transIds
         .map(() => "TRIM(?)")
         .join(",")})`,
      transIds,
    );
    for (const row of transRows || []) byId.set(row.id, row);
  }

  return mergeStatementsLinkedToInvoice(inv, [...byId.values()]);
}

/**
 * Resolve payment amount / UTR / date for an invoice number from invoices + linked statements.
 */
export async function lookupInvoiceLinkedPayment(conn, invoiceNumberRaw) {
  const invoiceNumber = String(invoiceNumberRaw || "").trim();
  if (!invoiceNumber) {
    return { found: false };
  }

  const [invRows] = await conn.execute(
    `SELECT id, invoice_number, grand_total, amount_paid, linked_trans_ids
     FROM invoices
     WHERE ${INV_NUM_EQ}
     ORDER BY id DESC
     LIMIT 1`,
    [invoiceNumber],
  );

  if (invRows.length) {
    const inv = invRows[0];
    const grandTotal = Number(inv.grand_total || 0);

    const linked = await fetchStatementCandidatesForInvoice(conn, inv);

    const amountPaidOnInvoice = Number(inv.amount_paid || 0);
    let payment_amount = amountPaidOnInvoice;
    let payments = [];
    if (linked.length > 0) {
      const allocated = allocateStatementPaymentsForInvoice(linked, grandTotal);
      // Never drop invoice.amount_paid when statement alloc is lower/empty.
      payment_amount = Math.max(amountPaidOnInvoice, allocated.total || 0);
      payments = allocated.payments;
      if (
        amountPaidOnInvoice > 0 &&
        allocated.total > 0 &&
        amountPaidOnInvoice > allocated.total
      ) {
        // Keep statement lines; amount_received on order uses payment_amount (max).
      }
    }

    const transIds = parseLinkedTransIds(inv.linked_trans_ids);
    if (!payments.length && payment_amount > 0) {
      if (transIds.length) {
        const each =
          transIds.length === 1
            ? payment_amount
            : payment_amount / transIds.length;
        payments = transIds.map((tid) => ({
          statement_id: null,
          trans_id: tid,
          date: null,
          amount: each,
        }));
      } else {
        payments = [
          {
            statement_id: null,
            trans_id: "",
            date: null,
            amount: payment_amount,
          },
        ];
      }
    } else if (payments.length && transIds.length) {
      // Fill missing trans_id from invoice.linked_trans_ids when needed.
      const used = new Set(
        payments.map((p) => String(p.trans_id || "").trim()).filter(Boolean),
      );
      for (const tid of transIds) {
        if (used.has(tid)) continue;
        if (payments.length === 1 && !String(payments[0].trans_id || "").trim()) {
          payments[0] = { ...payments[0], trans_id: tid };
          used.add(tid);
        }
      }
    }

    const latest = pickLatestStatement(linked);
    const orderCsv = linkedPaymentsToOrderPaymentCsv(payments);
    return {
      found: true,
      payment_amount,
      payments,
      payment_id:
        orderCsv.payment_id ||
        (latest?.trans_id ? String(latest.trans_id).trim() : null) ||
        (transIds[0] || null),
      payment_date:
        orderCsv.payment_date || formatStatementDate(latest?.date),
      payment_amount_csv: orderCsv.payment_amount,
      from_statements: linked.length > 0,
    };
  }

  const [stmtRows] = await conn.execute(
    `SELECT id, trans_id, date, amount, linked_purchase_ids, invoice_number
     FROM statements
     WHERE CHAR_LENGTH(TRIM(COALESCE(invoice_number, ''))) > 0 AND ${sqlLikeUtf8Contains("invoice_number")}`,
    [invoiceNumber],
  );

  const linked = statementsMatchingInvoiceNumber(stmtRows || [], invoiceNumber);
  if (!linked.length) {
    return { found: false };
  }

  const allocated = allocateStatementPaymentsForInvoice(linked, 0);
  const latest = pickLatestStatement(linked);

  const orderCsv = linkedPaymentsToOrderPaymentCsv(allocated.payments);
  return {
    found: true,
    payment_amount: allocated.total,
    payments: allocated.payments,
    payment_id:
      orderCsv.payment_id ||
      (latest?.trans_id ? String(latest.trans_id).trim() : null),
    payment_date:
      orderCsv.payment_date || formatStatementDate(latest?.date),
    payment_amount_csv: orderCsv.payment_amount,
    from_statements: true,
  };
}
