/**
 * Statement → client expense: create a new expense line (clone) instead of bumping an existing row.
 */

/**
 * @param {{ includeHead: boolean, includeSubs: string[], headLabel?: string|null }} allocation
 *        includeSubs = labels to copy; empty array = no sub rows. headLabel used when includeHead true.
 */
export async function applyExpenseAllocation(conn, expenseId, allocation, templateHeadFallback) {
  const id = Number(expenseId);
  if (!Number.isFinite(id) || id < 1) return;
  const headText =
    allocation?.includeHead && allocation?.headLabel != null && String(allocation.headLabel).trim() !== ""
      ? String(allocation.headLabel).trim()
      : allocation?.includeHead && templateHeadFallback != null && String(templateHeadFallback).trim() !== ""
        ? String(templateHeadFallback).trim()
        : null;
  const headVal = allocation?.includeHead ? headText : null;
  await conn.execute(`UPDATE client_expenses SET head = ? WHERE id = ?`, [headVal, id]);
  await conn.execute(`DELETE FROM client_expense_sub_heads WHERE client_expense_id = ?`, [id]);
  const subs = Array.isArray(allocation?.includeSubs) ? allocation.includeSubs : [];
  for (const s of subs) {
    const label = s != null ? String(s).trim() : "";
    if (!label) continue;
    await conn.execute(
      `INSERT INTO client_expense_sub_heads (client_expense_id, sub_head) VALUES (?, ?)`,
      [id, label],
    );
  }
}

/**
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number} templateId source expense row (dropdown selection)
 * @param {{ amount: number, transId: string, allocation?: { includeHead: boolean, includeSubs: string[], headLabel?: string|null } }} opts
 * @returns {Promise<number|null>} new client_expenses.id
 */
export async function cloneClientExpenseFromTemplate(conn, templateId, opts) {
  const tid = Number(templateId);
  if (!Number.isFinite(tid) || tid < 1) return null;

  const [rows] = await conn.execute(
    `SELECT id, expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply,
            type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount
     FROM client_expenses WHERE id = ?`,
    [tid],
  );
  const r = rows?.[0];
  if (!r) return null;

  const [subRows] = await conn.execute(
    `SELECT sub_head FROM client_expense_sub_heads WHERE client_expense_id = ? ORDER BY id`,
    [tid],
  );

  const amt = Number(opts.amount);
  const finalAmount = Number.isFinite(amt) ? Math.round(amt * 100) / 100 : 0;
  const txn =
    opts.transId != null && String(opts.transId).trim() !== ""
      ? String(opts.transId).trim()
      : null;

  const alloc = opts.allocation;
  const headForInsert =
    alloc && alloc.includeHead === false
      ? null
      : alloc?.headLabel != null && String(alloc.headLabel).trim() !== ""
        ? String(alloc.headLabel).trim()
        : r.head ?? null;

  const [ins] = await conn.execute(
    `INSERT INTO client_expenses (expense_name, client_name, group_name, tax_applicable, tax_type, main_head, head, supply,
        type_of_ledger, cgst, sgst, igst, hsn, transaction_id, gst_rate, amount)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      r.expense_name,
      r.client_name,
      r.group_name ?? null,
      r.tax_applicable != null ? r.tax_applicable : 0,
      r.tax_type ?? null,
      r.main_head,
      headForInsert,
      r.supply ?? null,
      r.type_of_ledger ?? null,
      r.cgst != null ? Number(r.cgst) : null,
      r.sgst != null ? Number(r.sgst) : null,
      r.igst != null ? Number(r.igst) : null,
      r.hsn ?? null,
      txn,
      r.gst_rate != null ? Number(r.gst_rate) : null,
      finalAmount,
    ],
  );
  const newId = ins.insertId;

  let subsToInsert = subRows || [];
  if (alloc && Array.isArray(alloc.includeSubs)) {
    const allow = new Set(alloc.includeSubs.map((s) => String(s || "").trim()).filter(Boolean));
    subsToInsert = subsToInsert.filter((sh) => {
      const label = sh?.sub_head != null ? String(sh.sub_head).trim() : "";
      return label && allow.has(label);
    });
  }
  for (const sh of subsToInsert) {
    const label = sh?.sub_head != null ? String(sh.sub_head).trim() : "";
    if (label) {
      await conn.execute(
        `INSERT INTO client_expense_sub_heads (client_expense_id, sub_head) VALUES (?, ?)`,
        [newId, label],
      );
    }
  }
  return newId;
}

/**
 * Remove expense row created for this statement (same trans_id), not the template.
 * @param {import("mysql2/promise").PoolConnection} conn
 * @param {number|null|undefined} expenseId
 * @param {string|null|undefined} statementTransId
 */
export async function deleteDedicatedExpenseForStatement(
  conn,
  expenseId,
  statementTransId,
) {
  const id = expenseId != null ? Number(expenseId) : NaN;
  if (!Number.isFinite(id) || id < 1) return;

  const st = String(statementTransId ?? "").trim();
  if (!st) return;

  const [rows] = await conn.execute(
    `SELECT id, transaction_id FROM client_expenses WHERE id = ?`,
    [id],
  );
  const row = rows?.[0];
  if (!row) return;

  const tr = String(row.transaction_id ?? "").trim();
  if (tr !== st) return;

  await conn.execute(`DELETE FROM client_expense_sub_heads WHERE client_expense_id = ?`, [
    id,
  ]);
  await conn.execute(`DELETE FROM client_expenses WHERE id = ?`, [id]);
}
