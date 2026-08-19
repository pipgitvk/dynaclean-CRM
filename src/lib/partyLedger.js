import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { EXCLUDE_PROFORMA_INVOICE_SQL } from "@/lib/ledgerInvoiceFilters";

function parseTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseLinkedPurchaseIds(raw) {
  if (!raw) return [];
  let arr = null;
  if (Array.isArray(raw)) arr = raw;
  else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!arr) return [];
  const keys = [];
  for (const v of arr) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      keys.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
    } else if (/^\d+$/.test(s)) {
      keys.push(`IP${s}`);
    }
  }
  return keys;
}

async function fetchRelevantStatements(conn, {
  invoiceIds = [],
  invoiceNumbers = [],
  transIds = [],
  purchaseTokens = [],
}) {
  const where = [];
  const values = [];

  if (invoiceNumbers.length > 0) {
    where.push(
      `invoice_number IN (${invoiceNumbers.map(() => "?").join(",")})`,
    );
    values.push(...invoiceNumbers);
  }

  if (invoiceIds.length > 0) {
    where.push(
      `(${invoiceIds.map(() => "linked_purchase_ids LIKE ?").join(" OR ")})`,
    );
    values.push(...invoiceIds.map((id) => `%IP${id}%`));
  }

  if (transIds.length > 0) {
    where.push(`trans_id IN (${transIds.map(() => "?").join(",")})`);
    values.push(...transIds);
  }

  for (const token of purchaseTokens) {
    where.push("linked_purchase_ids LIKE ?");
    values.push(`%${token}%`);
  }

  if (where.length === 0) return [];

  const [rows] = await conn.execute(
    `SELECT id, trans_id, date, amount, description, type, linked_purchase_ids, invoice_number, invoice_status
     FROM statements
     WHERE ${where.join(" OR ")}
     ORDER BY date ASC, id ASC`,
    values,
  );
  return rows;
}

/**
 * Append Return Completed ledger rows from warehouse-in credit notes.
 * Shared by parties ledger, buyer invoice ledger, and company ledger.
 */
export async function appendReturnCompletedEntries(conn, {
  partyName,
  customerId = null,
  invoiceNumbers = [],
  gstins = [],
  existingRows = [],
  derivedLedger,
}) {
  try {
    const partyGstinList = Array.from(
      new Set(
        (gstins || [])
          .map((g) => (g ? String(g).trim().toUpperCase() : ""))
          .filter(Boolean)
      )
    );

    if (partyGstinList.length === 0 && partyName) {
      try {
        const [gstRows] = await conn.execute(
          `SELECT DISTINCT UPPER(TRIM(gst_number)) AS gstin
           FROM invoices
           WHERE (TRIM(customer_name) = ? OR customer_name = ?)
             AND gst_number IS NOT NULL AND TRIM(gst_number) <> ''`,
          [partyName, partyName]
        );
        for (const r of gstRows) {
          if (r.gstin) partyGstinList.push(r.gstin);
        }
      } catch (_) {}
    }

    const whereParts = [
      "LOWER(TRIM(cn.company_name)) = LOWER(?)",
      "LOWER(TRIM(qr.company_name)) = LOWER(?)",
      "LOWER(TRIM(no.client_name)) = LOWER(?)",
    ];
    const whereParams = [partyName, partyName, partyName];

    const invs = Array.from(invoiceNumbers || []).filter(Boolean).map(String);
    if (invs.length > 0) {
      const ph = invs.map(() => "?").join(",");
      whereParts.push(`TRIM(cn.invoice_no) IN (${ph})`);
      whereParams.push(...invs);
      whereParts.push(`TRIM(no.invoice_number) IN (${ph})`);
      whereParams.push(...invs);
    }

    if (customerId) {
      whereParts.push("CAST(qr.customer_id AS CHAR) = ?");
      whereParams.push(String(customerId));
    }

    if (partyGstinList.length > 0) {
      const ph = partyGstinList.map(() => "?").join(",");
      whereParts.push(`UPPER(TRIM(cn.customer_gstin)) IN (${ph})`);
      whereParams.push(...partyGstinList);
      whereParts.push(`UPPER(TRIM(qr.gstin)) IN (${ph})`);
      whereParams.push(...partyGstinList);
    }

    const [cnRows] = await conn.execute(
      `SELECT
         cn.id,
         cn.order_id,
         cn.credit_note_number,
         cn.invoice_no,
         cn.grand_total,
         cn.return_type,
         cn.is_saved,
         COALESCE(no.warehouse_in_date, cn.credit_note_date, DATE(cn.saved_at), DATE(cn.created_at)) AS entry_date
       FROM credit_notes cn
       LEFT JOIN neworder no
         ON CAST(cn.order_id AS CHAR) COLLATE utf8mb4_unicode_ci
          = CAST(no.order_id AS CHAR) COLLATE utf8mb4_unicode_ci
       LEFT JOIN quotations_records qr
         ON no.quote_number = qr.quote_number
       WHERE COALESCE(no.warehouse_in_done, 0) = 1
         AND (${whereParts.join(" OR ")})`,
      whereParams
    );

    const existingReturnVchNos = new Set();
    for (const row of existingRows || []) {
      const t = String(row.vch_type || "");
      if (t === "Return" || t === "Return Completed") {
        if (row.vch_no) existingReturnVchNos.add(String(row.vch_no).trim().toLowerCase());
      }
    }

    const bestByOrder = new Map();
    for (const cn of cnRows) {
      const key = String(cn.order_id || cn.id);
      const prev = bestByOrder.get(key);
      if (!prev) {
        bestByOrder.set(key, cn);
        continue;
      }
      const prevSaved = Number(prev.is_saved) === 1 ? 1 : 0;
      const curSaved = Number(cn.is_saved) === 1 ? 1 : 0;
      if (curSaved > prevSaved || (curSaved === prevSaved && Number(cn.id) > Number(prev.id))) {
        bestByOrder.set(key, cn);
      }
    }

    for (const cn of bestByOrder.values()) {
      const invNo = cn.invoice_no ? String(cn.invoice_no).trim().toLowerCase() : "";
      const cnNo = cn.credit_note_number
        ? String(cn.credit_note_number).trim().toLowerCase()
        : "";
      if (
        (invNo && existingReturnVchNos.has(invNo)) ||
        (cnNo && existingReturnVchNos.has(cnNo))
      ) {
        continue;
      }

      const entryDate = cn.entry_date ? String(cn.entry_date).slice(0, 10) : null;
      if (!entryDate) continue;
      const amt = Number(cn.grand_total) || 0;
      if (amt <= 0) continue;

      const invLabel = cn.invoice_no || cn.credit_note_number || "";
      const isFull = String(cn.return_type || "").toLowerCase() === "full";
      derivedLedger.push({
        id: `cn-return-${cn.id}`,
        entry_date: entryDate,
        particulars: `Return Completed (${isFull ? "Full" : "Partial"})${
          invLabel ? ` – ${invLabel}` : ""
        }`,
        vch_type: "Return Completed",
        vch_no: cn.credit_note_number || cn.invoice_no || String(cn.id),
        debit: 0,
        credit: amt,
        source: "credit_note",
      });
    }
  } catch (e) {
    console.warn("[appendReturnCompletedEntries]", e?.message);
  }
}

/**
 * Compute ledger entries for a buyer/party.
 * Reuses the exact same logic as /admin-dashboard/ledger/[companyName] page.
 * @param {string} decodedCompany - Party name
 * @param {string|number|null} customerIdFilter - Optional specific customer_id (used for purchases filter + display)
 */
export async function buildLedgerForParty(decodedCompany, customerIdFilter = null) {
  const conn = await getDbConnection();

  let invoices = [];
  let customerIdForCompany = null;
  const cidFilter =
    customerIdFilter != null && String(customerIdFilter).trim() !== ""
      ? String(customerIdFilter).trim()
      : null;

  const [invRows] = await conn.execute(
    `SELECT
       id,
       invoice_number,
       employee_name,
       COALESCE(order_date, invoice_date) AS order_date,
       (COALESCE(cgst,0) + COALESCE(sgst,0) + COALESCE(igst,0)) AS tax_amount,
       grand_total,
       linked_trans_ids,
       billing_address,
       customer_id,
       gst_number,
       DATE(created_at) AS created_date,
       created_at
     FROM invoices
     WHERE (TRIM(customer_name) = ? OR customer_name = ?)
       AND ${EXCLUDE_PROFORMA_INVOICE_SQL}
     ORDER BY COALESCE(order_date, invoice_date) DESC, id DESC`,
    [decodedCompany, decodedCompany]
  );
  invoices = invRows;

  if (cidFilter) {
    customerIdForCompany = cidFilter;
  } else if (invoices.length > 0 && invoices[0].customer_id) {
    customerIdForCompany = invoices[0].customer_id;
  }

  if (!customerIdForCompany) {
    const [cRows] = await conn.execute(
      `SELECT customer_id FROM product_stock_request
       WHERE (TRIM(client_name) = ? OR TRIM(client_company_name) = ?)
         AND customer_id IS NOT NULL AND customer_id != 0
       LIMIT 1`,
      [decodedCompany, decodedCompany]
    );
    if (cRows.length > 0) customerIdForCompany = cRows[0].customer_id;
  }

  const buyerInvoiceIds = new Set(invoices.map((i) => i.id));
  const buyerInvoiceNumbers = new Set(
    invoices.map((i) => i.invoice_number).filter(Boolean),
  );

  const purchaseSelect = `
    SELECT
      id,
      COALESCE(invoice_date, DATE(created_at)) AS invoice_date,
      invoice_number,
      net_amount,
      client_name,
      CASE
        WHEN EXISTS (
          SELECT 1 FROM spare_list sl
          WHERE CAST(sl.id AS CHAR) = TRIM(CAST(product_code AS CHAR))
        )
        AND NOT EXISTS (
          SELECT 1 FROM products_list pl
          WHERE LOWER(TRIM(pl.item_code)) = LOWER(TRIM(product_code))
        ) THEN 'spare'
        ELSE 'product'
      END AS purchase_source
  `;

  const purchaseById = new Map();
  const addPurchases = (rows) => {
    for (const row of rows) {
      const key = `${row.purchase_source}-${row.id}`;
      if (!purchaseById.has(key)) purchaseById.set(key, row);
    }
  };

  if (customerIdForCompany) {
    const [pRows] = await conn.execute(
      `${purchaseSelect}
       FROM product_stock_request
       WHERE customer_id = ?
       ORDER BY COALESCE(invoice_date, DATE(created_at)) DESC, id DESC`,
      [customerIdForCompany],
    );
    addPurchases(pRows);
    try {
      const [spareRows] = await conn.execute(
        `SELECT
           id,
           DATE(created_at) AS invoice_date,
           NULL AS invoice_number,
           net_amount,
           client_name,
           'spare' AS purchase_source
         FROM spare_stock_request
         WHERE customer_id = ?
         ORDER BY created_at DESC, id DESC`,
        [customerIdForCompany],
      );
      addPurchases(spareRows);
    } catch (_) {}
  }

  const [supplierPurchases] = await conn.execute(
    `${purchaseSelect}
     FROM product_stock_request
     WHERE TRIM(client_company_name) = ?
     ORDER BY COALESCE(invoice_date, DATE(created_at)) DESC, id DESC`,
    [decodedCompany],
  );
  addPurchases(supplierPurchases);

  const purchaseRows = Array.from(purchaseById.values());
  const purchaseTokenSet = new Set();
  const tokenToSource = {};
  for (const purch of purchaseRows) {
    const token =
      purch.purchase_source === "spare" ? `PS${purch.id}` : `PP${purch.id}`;
    purchaseTokenSet.add(token);
    tokenToSource[token] = purch.purchase_source;
  }

  const transIdsFromInvoices = new Set();
  for (const inv of invoices) {
    for (const transId of parseTransIds(inv.linked_trans_ids)) {
      transIdsFromInvoices.add(transId);
    }
  }

  const relevantStatements = await fetchRelevantStatements(conn, {
    invoiceIds: [...buyerInvoiceIds],
    invoiceNumbers: [...buyerInvoiceNumbers],
    transIds: [...transIdsFromInvoices],
    purchaseTokens: [...purchaseTokenSet],
  });

  let statementRows = relevantStatements.filter((stmt) => {
    const inLinkedTransIds = invoices.some((inv) => {
      const invLinkedTransIds = parseTransIds(inv.linked_trans_ids);
      return invLinkedTransIds.includes(stmt.trans_id);
    });
    const matchesInvoiceNumber =
      stmt.invoice_number && buyerInvoiceNumbers.has(stmt.invoice_number);
    const linkedPurchaseTokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
    const hasLinkedInvoiceId = linkedPurchaseTokens.some((token) => {
      if (token.startsWith("IP")) {
        const invId = parseInt(token.replace("IP", ""));
        return buyerInvoiceIds.has(invId);
      }
      return false;
    });
    return inLinkedTransIds || matchesInvoiceNumber || hasLinkedInvoiceId;
  });

  let allLinkedInvoices = [];
  if (statementRows.length > 0) {
    const allLinkedInvoiceIds = new Set();
    const allLinkedInvoiceNumbers = new Set();
    for (const stmt of statementRows) {
      const tokens = parseTransIds(stmt.linked_purchase_ids);
      for (const token of tokens) {
        if (token.startsWith("IP"))
          allLinkedInvoiceIds.add(parseInt(token.replace("IP", "")));
      }
      if (stmt.invoice_number) allLinkedInvoiceNumbers.add(stmt.invoice_number);
    }
    invoices.forEach((inv) => {
      allLinkedInvoiceIds.add(inv.id);
      if (inv.invoice_number) allLinkedInvoiceNumbers.add(inv.invoice_number);
    });

    const queryParts = [];
    const queryParams = [];
    if (allLinkedInvoiceIds.size > 0) {
      const ph = Array.from(allLinkedInvoiceIds).map(() => "?").join(",");
      queryParts.push(`id IN (${ph})`);
      queryParams.push(...Array.from(allLinkedInvoiceIds));
    }
    if (allLinkedInvoiceNumbers.size > 0) {
      const ph = Array.from(allLinkedInvoiceNumbers).map(() => "?").join(",");
      queryParts.push(`invoice_number IN (${ph})`);
      queryParams.push(...Array.from(allLinkedInvoiceNumbers));
    }

    if (queryParts.length > 0) {
      const [allInvRows] = await conn.execute(
        `SELECT id, grand_total, linked_trans_ids, invoice_number
         FROM invoices
         WHERE (${queryParts.join(" OR ")}) AND ${EXCLUDE_PROFORMA_INVOICE_SQL}`,
        queryParams
      );
      allLinkedInvoices = allInvRows;
    }
  }

  const invoiceMap = {};
  const invoiceNumberToIdMap = {};
  for (const inv of allLinkedInvoices) {
    invoiceMap[inv.id] = inv;
    if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
  }

  const transToInvoiceIdsMap = {};
  for (const stmt of statementRows) {
    const allIdsInOrder = [];
    const seenIds = new Set();
    const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
    for (const token of tokens) {
      if (token.startsWith("IP")) {
        const invId = parseInt(token.replace("IP", ""));
        if (invoiceMap[invId] && !seenIds.has(invId)) {
          allIdsInOrder.push(invId);
          seenIds.add(invId);
        }
      }
    }
    if (stmt.invoice_number && invoiceNumberToIdMap[stmt.invoice_number]) {
      const invId = invoiceNumberToIdMap[stmt.invoice_number];
      if (!seenIds.has(invId)) {
        allIdsInOrder.push(invId);
        seenIds.add(invId);
      }
    }
    const buyerIds = [];
    const otherIds = [];
    for (const invId of allIdsInOrder) {
      if (buyerInvoiceIds.has(invId)) buyerIds.push(invId);
      else otherIds.push(invId);
    }
    transToInvoiceIdsMap[stmt.trans_id] = [...buyerIds, ...otherIds];
  }

  const allocationMap = {};
  const invoiceRemainingMap = {};
  for (const invId in invoiceMap) {
    invoiceRemainingMap[invId] = Number(invoiceMap[invId].grand_total) || 0;
  }

  for (const stmt of statementRows) {
    const linkedInvIds = transToInvoiceIdsMap[stmt.trans_id] || [];
    if (linkedInvIds.length === 0) continue;
    let remainingToAllocate = Math.abs(Number(stmt.amount) || 0);
    const invoicePaidForStmt = {};
    for (const invId of linkedInvIds) {
      if (remainingToAllocate <= 0) break;
      const invRemaining = invoiceRemainingMap[invId] || 0;
      if (invRemaining <= 0) continue;
      const toAllocate = Math.min(invRemaining, remainingToAllocate);
      if (toAllocate > 0) {
        invoicePaidForStmt[invId] = toAllocate;
        invoiceRemainingMap[invId] -= toAllocate;
        remainingToAllocate -= toAllocate;
      }
    }
    for (const invId of linkedInvIds) {
      allocationMap[`${invId}-${stmt.trans_id}`] = invoicePaidForStmt[invId] || 0;
    }
  }

  const derivedLedger = [];

  for (const inv of invoices) {
    const invDate = String(inv.created_date).slice(0, 10);
    derivedLedger.push({
      id: `inv-${inv.id}`,
      entry_date: invDate,
      particulars: `Sales – ${inv.invoice_number}`,
      vch_type: "Sales",
      vch_no: inv.invoice_number,
      debit: Number(inv.grand_total) || 0,
      credit: 0,
      source: "invoice",
    });
  }

  for (const purch of purchaseRows) {
    const purchDate = purch.invoice_date
      ? String(purch.invoice_date).slice(0, 10)
      : null;
    if (!purchDate) continue;
    const purchLabel = purch.purchase_source === "spare" ? "Spare Purchase" : "Purchase";
    const purchIdPrefix = purch.purchase_source === "spare" ? "spare-purch" : "purch";
    derivedLedger.push({
      id: `${purchIdPrefix}-${purch.id}`,
      entry_date: purchDate,
      particulars: `${purchLabel} – ${purch.invoice_number || `#${purch.id}`}`,
      vch_type: purchLabel,
      vch_no: purch.invoice_number,
      debit: 0,
      credit: Number(purch.net_amount) || 0,
      source: "purchase",
    });
  }

  const seenPaymentStmtIds = new Set();
  for (const stmt of relevantStatements) {
    const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
    const matchingTokens = tokens.filter(
      (t) =>
        (t.startsWith("PP") || t.startsWith("PS")) && purchaseTokenSet.has(t)
    );
    if (matchingTokens.length === 0 || seenPaymentStmtIds.has(stmt.id))
      continue;
    seenPaymentStmtIds.add(stmt.id);
    const stmtDate = stmt.date ? String(stmt.date).slice(0, 10) : null;
    if (!stmtDate) continue;
    const isSparePayment = matchingTokens.every(
      (t) => t.startsWith("PS") || tokenToSource[t] === "spare"
    );
    derivedLedger.push({
      id: `pmt-${stmt.id}`,
      entry_date: stmtDate,
      particulars: stmt.description
        ? stmt.description
        : `${isSparePayment ? "Spare" : "Payment"} – ${stmt.trans_id}`,
      vch_type: isSparePayment ? "Spare" : "Payment",
      vch_no: String(stmt.trans_id),
      debit: Math.abs(Number(stmt.amount) || 0),
      credit: 0,
      source: "purchase_payment",
    });
  }

  for (const inv of invoices) {
    const relevantTransIds = new Set([
      ...parseTransIds(inv.linked_trans_ids),
      ...statementRows
        .filter((s) => s.invoice_number === inv.invoice_number)
        .map((s) => s.trans_id),
      ...statementRows
        .filter((s) => {
          const tokens = parseLinkedPurchaseIds(s.linked_purchase_ids);
          return tokens.includes(`IP${inv.id}`);
        })
        .map((s) => s.trans_id),
    ]);
    for (const transId of relevantTransIds) {
      const stmt = statementRows.find((s) => s.trans_id === transId);
      if (!stmt) continue;
      const stmtDate = stmt.date ? String(stmt.date).slice(0, 10) : null;
      if (!stmtDate) continue;
      const key = `${inv.id}-${transId}`;
      const allocatedAmount = allocationMap[key] || 0;
      if (allocatedAmount <= 0) continue;
      derivedLedger.push({
        id: `stmt-${transId}-inv-${inv.id}`,
        entry_date: stmtDate,
        particulars: stmt.description
          ? `${stmt.description} (${inv.invoice_number})`
          : `Payment received – ${inv.invoice_number}`,
        vch_type: "Receipt",
        vch_no: String(transId),
        debit: 0,
        credit: allocatedAmount,
        source: "statement",
      });
    }
  }

  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS ledger_entries (
        id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        entry_date    DATE          NOT NULL,
        particulars   VARCHAR(500)  NOT NULL,
        vch_type      VARCHAR(100)  NOT NULL DEFAULT '',
        vch_no        VARCHAR(100)  NOT NULL DEFAULT '',
        debit         DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        credit        DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        buyer_name    VARCHAR(255)  NULL,
        created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    try {
      await conn.execute("SELECT buyer_name FROM ledger_entries LIMIT 1");
    } catch (_) {
      try {
        await conn.execute(
          "ALTER TABLE ledger_entries ADD COLUMN buyer_name VARCHAR(255) NULL"
        );
      } catch (__) {}
    }
  } catch (_) {}

  const [manualRows] = await conn.execute(
    `SELECT id, entry_date, particulars, vch_type, vch_no, debit, credit, created_at
     FROM ledger_entries
     WHERE buyer_name = ?
     ORDER BY entry_date ASC, id ASC`,
    [decodedCompany]
  );

  const returnEntriesMap = {};
  for (const row of manualRows) {
    if (row.vch_type === "Return") {
      const invoiceNo = row.vch_no;
      if (
        !returnEntriesMap[invoiceNo] ||
        new Date(row.created_at) > new Date(returnEntriesMap[invoiceNo].created_at)
      ) {
        returnEntriesMap[invoiceNo] = row;
      }
    }
  }

  const filteredManualRows = manualRows.filter((row) => {
    if (row.vch_type === "Return") {
      return returnEntriesMap[row.vch_no]?.id === row.id;
    }
    return true;
  });

  await appendReturnCompletedEntries(conn, {
    partyName: decodedCompany,
    customerId: customerIdForCompany,
    invoiceNumbers: buyerInvoiceNumbers,
    gstins: invoices.map((i) => i.gst_number).filter(Boolean),
    existingRows: filteredManualRows,
    derivedLedger,
  });

  const combined = [
    ...derivedLedger,
    ...filteredManualRows.map((r) => ({ ...r, source: "manual" })),
  ].sort((a, b) => {
    const da = String(a.entry_date).slice(0, 10);
    const db = String(b.entry_date).slice(0, 10);
    if (da < db) return -1;
    if (da > db) return 1;
    const orderMap = {
      Sales: 0,
      Return: 1,
      "Return Completed": 1,
      Purchase: 2,
      "Spare Purchase": 2,
      Spare: 3,
      Payment: 3,
      Receipt: 4,
    };
    const aOrder =
      orderMap[a.vch_type] !== undefined ? orderMap[a.vch_type] : 99;
    const bOrder =
      orderMap[b.vch_type] !== undefined ? orderMap[b.vch_type] : 99;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return 0;
  });

  const serialized = combined.map((e) => ({
    ...e,
    entry_date: String(e.entry_date).slice(0, 10),
    created_at: e.created_at
      ? String(e.created_at).slice(0, 19)
      : undefined,
  }));

  return { entries: serialized, customerId: customerIdForCompany };
}
