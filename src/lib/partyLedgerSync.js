import { getDbConnection } from "@/lib/db";
import { buildLedgerForParty } from "@/lib/partyLedger";
import {
  ensurePartyLedgerLinesTable,
  netBalanceSide,
} from "@/lib/ensurePartyLedgerLinesTable";
import { computeLedgerTotals } from "@/lib/partyLedger";

function normalizeCustomerId(customerId) {
  if (customerId == null) return "";
  const s = String(customerId).trim();
  if (!s || s === "0") return "";
  return s;
}

function entrySourceKey(entry, index) {
  if (entry.id != null && String(entry.id).trim() !== "") {
    return String(entry.id).slice(0, 128);
  }
  const src = String(entry.source || "row").slice(0, 40);
  return `${src}-${index}`.slice(0, 128);
}

/**
 * Distinct parties to rebuild ledger snapshots for.
 */
export async function listPartyTargets(conn) {
  const byCid = new Map();

  const [invRows] = await conn.execute(
    `SELECT DISTINCT
       CAST(customer_id AS CHAR) AS customer_id,
       TRIM(customer_name) AS party_name
     FROM invoices
     WHERE customer_id IS NOT NULL
       AND customer_id != 0
       AND customer_name IS NOT NULL
       AND TRIM(customer_name) != ''`,
  );
  for (const r of invRows) {
    const cid = normalizeCustomerId(r.customer_id);
    const name = String(r.party_name || "").trim();
    if (!cid || !name) continue;
    if (!byCid.has(cid)) byCid.set(cid, name);
  }

  const [psrRows] = await conn.execute(
    `SELECT DISTINCT
       CAST(customer_id AS CHAR) AS customer_id,
       TRIM(COALESCE(client_company_name, client_name)) AS party_name
     FROM product_stock_request
     WHERE customer_id IS NOT NULL
       AND customer_id != 0
       AND (TRIM(COALESCE(client_company_name, client_name)) != '')`,
  );
  for (const r of psrRows) {
    const cid = normalizeCustomerId(r.customer_id);
    const name = String(r.party_name || "").trim();
    if (!cid || !name) continue;
    if (!byCid.has(cid)) byCid.set(cid, name);
  }

  try {
    const [spareRows] = await conn.execute(
      `SELECT DISTINCT
         CAST(customer_id AS CHAR) AS customer_id,
         TRIM(COALESCE(client_company_name, client_name)) AS party_name
       FROM spare_stock_request
       WHERE customer_id IS NOT NULL
         AND customer_id != 0
         AND (TRIM(COALESCE(client_company_name, client_name)) != '')`,
    );
    for (const r of spareRows) {
      const cid = normalizeCustomerId(r.customer_id);
      const name = String(r.party_name || "").trim();
      if (!cid || !name) continue;
      if (!byCid.has(cid)) byCid.set(cid, name);
    }
  } catch (_) {}

  if (byCid.size > 0) {
    const ids = [...byCid.keys()];
    const placeholders = ids.map(() => "?").join(",");
    const [custRows] = await conn.execute(
      `SELECT
         CAST(customer_id AS CHAR) AS customer_id,
         TRIM(company) AS company,
         TRIM(CONCAT_WS(' ', first_name, last_name)) AS full_name
       FROM customers
       WHERE CAST(customer_id AS CHAR) IN (${placeholders})`,
      ids,
    );
    for (const r of custRows) {
      const cid = normalizeCustomerId(r.customer_id);
      const canonical = String(r.company || r.full_name || "").trim();
      if (cid && canonical) byCid.set(cid, canonical);
    }
  }

  const nameOnly = new Map();
  const [manualRows] = await conn.execute(
    `SELECT DISTINCT TRIM(buyer_name) AS party_name
     FROM ledger_entries
     WHERE buyer_name IS NOT NULL AND TRIM(buyer_name) != ''`,
  );
  for (const r of manualRows) {
    const name = String(r.party_name || "").trim();
    if (name) nameOnly.set(`name:${name.toLowerCase()}`, name);
  }

  const withCustomerId = [...byCid.entries()].map(([customer_id, party_name]) => ({
    customer_id,
    party_name,
  }));
  const withoutCustomerId = [...nameOnly.values()].map((party_name) => ({
    customer_id: "",
    party_name,
  }));

  return [...withCustomerId, ...withoutCustomerId];
}

async function upsertPartyLedgerBalance(connection, customerId, partyName) {
  const customer_id = normalizeCustomerId(customerId);
  const name = String(partyName || "").trim();

  const [aggRows] = await connection.execute(
    `SELECT
       COALESCE(SUM(debit), 0) AS total_debit,
       COALESCE(SUM(credit), 0) AS total_credit,
       COUNT(*) AS line_count
     FROM party_ledger_lines
     WHERE customer_id = ? AND party_name = ?`,
    [customer_id, name],
  );
  const agg = aggRows[0] || {};
  const totalDebit = Number(agg.total_debit || 0);
  const totalCredit = Number(agg.total_credit || 0);
  const net = totalDebit - totalCredit;
  const { net_balance, balance_side } = netBalanceSide(net);
  const lineCount = Number(agg.line_count || 0);

  await connection.execute(
    `INSERT INTO party_ledger_balances (
       customer_id, party_name, total_debit, total_credit,
       net_balance, balance_side, line_count, synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       total_debit = VALUES(total_debit),
       total_credit = VALUES(total_credit),
       net_balance = VALUES(net_balance),
       balance_side = VALUES(balance_side),
       line_count = VALUES(line_count),
       synced_at = NOW()`,
    [
      customer_id,
      name,
      totalDebit,
      totalCredit,
      net_balance,
      balance_side,
      lineCount,
    ],
  );

  return {
    total_debit: totalDebit,
    total_credit: totalCredit,
    net_balance,
    balance_side,
    line_count: lineCount,
  };
}

async function partyHasSnapshot(conn, customerId, partyName) {
  const customer_id = normalizeCustomerId(customerId);
  const name = String(partyName || "").trim();
  if (!name) return false;
  try {
    const [rows] = await conn.execute(
      `SELECT 1 FROM party_ledger_balances
       WHERE customer_id = ? AND party_name = ?
       LIMIT 1`,
      [customer_id, name],
    );
    if (rows.length > 0) return true;
  } catch (_) {}
  const [rows] = await conn.execute(
    `SELECT 1 FROM party_ledger_lines
     WHERE customer_id = ? AND party_name = ?
     LIMIT 1`,
    [customer_id, name],
  );
  return rows.length > 0;
}

/**
 * Persist pre-built ledger rows for one party.
 * Default: INSERT IGNORE — existing lines (same source_key) are skipped.
 * options.replace: true → delete party rows first, then insert fresh.
 */
export async function savePartyLedgerEntriesToDatabase(
  partyName,
  customerId,
  entries,
  options = {},
) {
  const conn = await ensurePartyLedgerLinesTable();
  const name = String(partyName || "").trim();
  if (!name) {
    throw new Error("party_name is required");
  }

  const customer_id = normalizeCustomerId(customerId);
  const rows = Array.isArray(entries) ? entries : [];
  const replace = Boolean(options.replace);

  let inserted = 0;
  let skipped = 0;
  let balance = null;

  const connection = await conn.getConnection();
  try {
    await connection.beginTransaction();

    if (replace) {
      await connection.execute(
        `DELETE FROM party_ledger_lines
         WHERE customer_id = ? AND party_name = ?`,
        [customer_id, name],
      );
      await connection.execute(
        `DELETE FROM party_ledger_balances
         WHERE customer_id = ? AND party_name = ?`,
        [customer_id, name],
      );
    }

    if (rows.length > 0) {
      const insertSql = replace
        ? `
        INSERT INTO party_ledger_lines (
          customer_id, party_name, source_key, entry_date, particulars,
          vch_type, vch_no, debit, credit, source, sort_order, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
        : `
        INSERT IGNORE INTO party_ledger_lines (
          customer_id, party_name, source_key, entry_date, particulars,
          vch_type, vch_no, debit, credit, source, sort_order, synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;

      for (let i = 0; i < rows.length; i++) {
        const e = rows[i];
        const entryDate = String(e.entry_date || "").slice(0, 10);
        if (!entryDate || entryDate === "Invalid Date") continue;

        const [result] = await connection.execute(insertSql, [
          customer_id,
          name,
          entrySourceKey(e, i),
          entryDate,
          String(e.particulars || "").slice(0, 500),
          String(e.vch_type || "").slice(0, 100),
          String(e.vch_no ?? "").slice(0, 100),
          Number(e.debit || 0),
          Number(e.credit || 0),
          String(e.source || "").slice(0, 64),
          i,
        ]);
        if (Number(result?.affectedRows || 0) > 0) inserted += 1;
        else skipped += 1;
      }
    }

    balance = await upsertPartyLedgerBalance(connection, customer_id, name);

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  const totals = computeLedgerTotals(rows);

  return {
    customer_id,
    party_name: name,
    line_count: rows.length,
    inserted,
    skipped,
    total_debit: balance?.total_debit ?? totals.debit,
    total_credit: balance?.total_credit ?? totals.credit,
    net_balance: balance?.net_balance ?? totals.netBalance,
    balance_side: balance?.balance_side ?? netBalanceSide(totals.netBalance).balance_side,
  };
}

/**
 * Rebuild stored ledger lines for one party (matches buildLedgerForParty output).
 */
export async function syncPartyLedgerToDatabase(
  partyName,
  customerId = null,
  options = {},
) {
  const name = String(partyName || "").trim();
  if (!name) {
    throw new Error("party_name is required");
  }

  const conn = await ensurePartyLedgerLinesTable();
  const cidFilter = normalizeCustomerId(customerId);
  const skipExistingParty =
    options.skipExistingParty !== false && !options.replace;

  if (skipExistingParty && (await partyHasSnapshot(conn, cidFilter, name))) {
    return {
      customer_id: cidFilter,
      party_name: name,
      skipped_party: true,
      line_count: 0,
      inserted: 0,
      skipped: 0,
    };
  }

  const { entries, customerId: resolvedCid } = await buildLedgerForParty(
    name,
    cidFilter || null,
  );
  const customer_id = cidFilter || normalizeCustomerId(resolvedCid);

  return savePartyLedgerEntriesToDatabase(name, customer_id, entries, options);
}

/** Fill party_ledger_balances from existing lines (after migration). */
export async function backfillPartyLedgerBalancesFromLines(conn) {
  const db = conn || (await ensurePartyLedgerLinesTable());
  try {
    await db.execute(
      `INSERT INTO party_ledger_balances (
         customer_id, party_name, total_debit, total_credit,
         net_balance, balance_side, line_count, synced_at
       )
       SELECT
         customer_id,
         party_name,
         COALESCE(SUM(debit), 0),
         COALESCE(SUM(credit), 0),
         COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0),
         CASE
           WHEN ABS(COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0)) <= 0.01 THEN 'flat'
           WHEN COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) > 0 THEN 'Dr'
           ELSE 'Cr'
         END,
         COUNT(*),
         NOW()
       FROM party_ledger_lines
       GROUP BY customer_id, party_name
       ON DUPLICATE KEY UPDATE
         total_debit = VALUES(total_debit),
         total_credit = VALUES(total_credit),
         net_balance = VALUES(net_balance),
         balance_side = VALUES(balance_side),
         line_count = VALUES(line_count),
         synced_at = NOW()`,
    );
  } catch (_) {}
  return db;
}

/**
 * Rebuild ledger snapshots for all known parties.
 */
export async function syncAllPartyLedgersToDatabase(options = {}) {
  const conn = await ensurePartyLedgerLinesTable();
  await backfillPartyLedgerBalancesFromLines(conn);
  const targets = await listPartyTargets(conn);
  const skipExistingParties = options.skipExistingParties !== false;

  const results = [];
  const errors = [];
  let parties_skipped = 0;
  let lines_inserted = 0;
  let lines_skipped = 0;

  for (const t of targets) {
    try {
      if (
        skipExistingParties &&
        !options.replace &&
        (await partyHasSnapshot(conn, t.customer_id, t.party_name))
      ) {
        parties_skipped += 1;
        continue;
      }

      const r = await syncPartyLedgerToDatabase(
        t.party_name,
        t.customer_id || null,
        {
          replace: Boolean(options.replace),
          skipExistingParty: false,
        },
      );
      lines_inserted += Number(r.inserted || 0);
      lines_skipped += Number(r.skipped || 0);
      results.push(r);
    } catch (err) {
      errors.push({
        party_name: t.party_name,
        customer_id: t.customer_id,
        error: err?.message || String(err),
      });
    }
  }

  const [countRows] = await conn.execute(
    `SELECT COUNT(*) AS total_lines FROM party_ledger_lines`,
  );

  const uniqueErrors = [...new Set(errors.map((e) => e.error))];

  return {
    parties_synced: results.length,
    parties_skipped,
    parties_failed: errors.length,
    parties_total: targets.length,
    lines_inserted,
    lines_skipped,
    total_lines: Number(countRows[0]?.total_lines || 0),
    results: results.slice(0, 50),
    errors: errors.slice(0, 30),
    error_messages: uniqueErrors.slice(0, 10),
  };
}

export async function getPartyLedgerSnapshotStats() {
  const conn = await ensurePartyLedgerLinesTable();
  const [rows] = await conn.execute(
    `SELECT
       COUNT(*) AS total_lines,
       COUNT(DISTINCT CONCAT(customer_id, '|', party_name)) AS party_count,
       MAX(synced_at) AS last_synced_at
     FROM party_ledger_lines`,
  );
  const stats = rows[0] || {};
  return {
    total_lines: Number(stats.total_lines || 0),
    party_count: Number(stats.party_count || 0),
    last_synced_at: stats.last_synced_at || null,
  };
}
