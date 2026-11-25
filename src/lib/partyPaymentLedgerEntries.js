import { ensurePartyPaymentsTable } from "@/lib/ensurePartyPaymentsTable";
import {
  ensurePartyPaymentHistoryTable,
  reconcilePartyPaymentTotalsFromHistory,
} from "@/lib/partyPaymentHistory";

function normalizeKey(s) {
  return String(s || "").trim().toLowerCase();
}

function buildPartyPaymentWhere(customerId, nameAliases) {
  const where = [];
  const params = [];
  const cid = customerId != null ? String(customerId).trim() : "";
  if (cid && cid !== "0") {
    where.push("(customer_id IS NOT NULL AND TRIM(customer_id) = ?)");
    params.push(cid);
  }
  const keys = [
    ...new Set(
      (nameAliases || []).map((n) => normalizeKey(n)).filter(Boolean),
    ),
  ];
  if (keys.length) {
    const nameParts = keys.map(() => "LOWER(TRIM(name)) = ?");
    const companyParts = keys.map(() => "LOWER(TRIM(company_name)) = ?");
    where.push(`(${nameParts.join(" OR ")})`);
    where.push(`(${companyParts.join(" OR ")})`);
    params.push(...keys, ...keys);
  }
  if (!where.length) return null;
  return { sql: where.join(" OR "), params };
}

function historyParticulars(line, partyPaymentId) {
  const tag = line.entry_type === "out" ? "Out" : "In";
  const bits = [`Party payment ${tag}`];
  if (line.trans_id) bits.push(line.trans_id);
  else if (line.order_id) bits.push(`Order ${line.order_id}`);
  if (line.invoice_number) bits.push(line.invoice_number);
  bits.push(`#${partyPaymentId}`);
  return bits.join(" · ");
}

/**
 * Append party_payments in/out lines to party ledger (admin parties page).
 */
export async function appendPartyPaymentLedgerEntries(
  conn,
  { customerId = null, nameAliases = [], derivedLedger },
) {
  await ensurePartyPaymentsTable(conn);
  await ensurePartyPaymentHistoryTable(conn);

  const filter = buildPartyPaymentWhere(customerId, nameAliases);
  if (!filter) return;

  const [paymentRows] = await conn.execute(
    `SELECT id, customer_id, name, company_name, payment_date, amount_in, amount_out, created_by
     FROM party_payments
     WHERE ${filter.sql}
     ORDER BY COALESCE(payment_date, DATE(created_at)), id`,
    filter.params,
  );

  for (const pp of paymentRows || []) {
    const ppId = Number(pp.id);
    if (!ppId) continue;

    try {
      await reconcilePartyPaymentTotalsFromHistory(conn, ppId);
    } catch (_) {
      /* non-fatal */
    }

    const [histRows] = await conn.execute(
      `SELECT id, entry_type, amount, order_id, invoice_number, statement_id,
              trans_id, entry_date, created_at
       FROM party_payment_history
       WHERE party_payment_id = ?
       ORDER BY COALESCE(entry_date, DATE(created_at)), id`,
      [ppId],
    );

    const fallbackDate = pp.payment_date
      ? String(pp.payment_date).slice(0, 10)
      : null;

    if (histRows?.length) {
      for (const h of histRows) {
        const amt = Number(h.amount) || 0;
        if (amt <= 0) continue;
        const entryDate = h.entry_date
          ? String(h.entry_date).slice(0, 10)
          : fallbackDate;
        if (!entryDate) continue;
        const isOut = String(h.entry_type).toLowerCase() === "out";
        derivedLedger.push({
          id: `pp-hist-${h.id}`,
          entry_date: entryDate,
          particulars: historyParticulars(h, ppId),
          vch_type: isOut ? "Party Pay Out" : "Party Pay In",
          vch_no: isOut
            ? h.order_id
              ? String(h.order_id)
              : `PP-${ppId}-OUT`
            : h.trans_id
              ? String(h.trans_id)
              : `PP-${ppId}-IN`,
          debit: isOut ? amt : 0,
          credit: isOut ? 0 : amt,
          source: "party_payment",
          party_payment_id: ppId,
        });
      }
      continue;
    }

    const inAmt = Number(pp.amount_in) || 0;
    const outAmt = Number(pp.amount_out) || 0;
    if (!fallbackDate) continue;

    if (inAmt > 0) {
      derivedLedger.push({
        id: `pp-${ppId}-in`,
        entry_date: fallbackDate,
        particulars: `Party payment In · #${ppId}`,
        vch_type: "Party Pay In",
        vch_no: `PP-${ppId}`,
        debit: 0,
        credit: inAmt,
        source: "party_payment",
        party_payment_id: ppId,
      });
    }
    if (outAmt > 0) {
      derivedLedger.push({
        id: `pp-${ppId}-out`,
        entry_date: fallbackDate,
        particulars: `Party payment Out · #${ppId}`,
        vch_type: "Party Pay Out",
        vch_no: `PP-${ppId}`,
        debit: outAmt,
        credit: 0,
        source: "party_payment",
        party_payment_id: ppId,
      });
    }
  }
}