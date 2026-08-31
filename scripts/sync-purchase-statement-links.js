/**
 * Safely sync linked_statement_ids from statements.linked_purchase_ids.
 * - Merges missing values only (never wipes existing links).
 * - Supports multiple purchases in one statement (e.g. PP356 + PP357, SP356 + SP357).
 * - Fixes malformed tokens like P356 -> PP356 in statements.
 *
 * Usage:
 *   node scripts/sync-purchase-statement-links.js --dry-run
 *   node scripts/sync-purchase-statement-links.js
 *   node scripts/sync-purchase-statement-links.js --scope=product
 *   node scripts/sync-purchase-statement-links.js --scope=spare
 *   node scripts/sync-purchase-statement-links.js --scope=all
 *   node scripts/sync-purchase-statement-links.js --store=trans_id
 *   node scripts/sync-purchase-statement-links.js --store=statement-id
 *   node scripts/sync-purchase-statement-links.js --store=both
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

function getArgValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const dryRun = process.argv.includes("--dry-run");
const fixTokens = !process.argv.includes("--no-fix-tokens");
const storeMode = getArgValue("store", "trans_id");
const scope = getArgValue("scope", "all");

const PURCHASE_TARGETS = {
  PP: {
    label: "product",
    table: "product_stock_request",
    enabled: scope === "all" || scope === "product",
  },
  PS: {
    label: "spare",
    table: "spare_stock_request",
    enabled: scope === "all" || scope === "spare",
  },
};

async function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dynaclean_crm1",
  });
}

function expandRawValues(rawVal) {
  if (rawVal == null || String(rawVal).trim() === "") return [];
  let arr = null;
  try {
    const parsed = JSON.parse(String(rawVal));
    if (Array.isArray(parsed)) arr = parsed;
  } catch {
    arr = String(rawVal)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const expanded = [];
  for (const value of arr || []) {
    String(value)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((part) => expanded.push(part));
  }
  return expanded;
}

function parseLinkedPurchaseTokens(rawVal) {
  const out = [];
  for (const value of expandRawValues(rawVal)) {
    const s = String(value).trim().toUpperCase();
    if (!s) continue;

    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      out.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
      continue;
    }

    // P356 -> PP356
    if (/^P\d+$/.test(s)) {
      out.push(`PP${s.slice(1)}`);
      continue;
    }

    if (/^\d+$/.test(s)) {
      out.push(`PP${s}`);
    }
  }
  return out;
}

function parseLinkedStatementIds(rawVal) {
  if (rawVal == null || String(rawVal).trim() === "") return [];
  try {
    const parsed = JSON.parse(String(rawVal));
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v) => v != null && String(v).trim() !== "")
        .map((v) => String(v).trim());
    }
  } catch {
    // fall through
  }
  return String(rawVal)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mergeUnique(existing, additions) {
  const next = [...existing];
  for (const value of additions) {
    const normalized = String(value).trim();
    if (!normalized) continue;
    if (!next.some((item) => String(item) === normalized)) {
      next.push(normalized);
    }
  }
  return next;
}

function buildValuesToAdd(stmt, mode) {
  const values = [];
  if (mode === "trans_id" || mode === "both") {
    if (stmt.trans_id != null && String(stmt.trans_id).trim() !== "") {
      values.push(String(stmt.trans_id).trim());
    }
  }
  if (mode === "statement-id" || mode === "both") {
    if (stmt.id != null) {
      values.push(String(stmt.id));
    }
  }
  return values;
}

function normalizeBrokenPurchaseTokens(rawVal) {
  const expanded = expandRawValues(rawVal);
  if (expanded.length === 0) return rawVal;

  let changed = false;
  const normalized = expanded.map((item) => {
    const s = String(item ?? "").trim().toUpperCase();
    if (/^P\d+$/.test(s)) {
      changed = true;
      return `PP${s.slice(1)}`;
    }
    return String(item).trim();
  });

  if (!changed) return rawVal;
  return JSON.stringify(normalized);
}

async function columnExists(conn, tableName, columnName) {
  try {
    await conn.execute(`SELECT ${columnName} FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

async function ensureLinkedStatementIdsColumn(conn, tableName) {
  const exists = await columnExists(conn, tableName, "linked_statement_ids");
  if (exists) return true;

  if (dryRun) {
    console.log(`[dry-run] Would add ${tableName}.linked_statement_ids column`);
    return false;
  }

  await conn.execute(
    `ALTER TABLE ${tableName} ADD COLUMN linked_statement_ids TEXT NULL`
  );
  console.log(`Added linked_statement_ids column to ${tableName}`);
  return true;
}

async function fetchPurchaseRow(conn, tableName, purchaseId) {
  const hasLinkedColumn = await columnExists(conn, tableName, "linked_statement_ids");
  if (!hasLinkedColumn) {
    const [rows] = await conn.execute(`SELECT id FROM ${tableName} WHERE id = ?`, [purchaseId]);
    return rows[0] ? { id: rows[0].id, linked_statement_ids: null } : null;
  }

  const [rows] = await conn.execute(
    `SELECT id, linked_statement_ids FROM ${tableName} WHERE id = ?`,
    [purchaseId]
  );
  return rows[0] || null;
}

async function fixMalformedStatementTokens(conn) {
  const [rows] = await conn.execute(`
    SELECT id, linked_purchase_ids
    FROM statements
    WHERE linked_purchase_ids IS NOT NULL
      AND TRIM(linked_purchase_ids) <> ''
      AND TRIM(linked_purchase_ids) <> 'null'
  `);

  let fixedCount = 0;
  for (const row of rows) {
    const nextValue = normalizeBrokenPurchaseTokens(row.linked_purchase_ids);
    if (nextValue === row.linked_purchase_ids) continue;

    console.log(
      `Fix statement #${row.id}: ${row.linked_purchase_ids} -> ${nextValue}`
    );

    if (!dryRun) {
      await conn.execute(
        "UPDATE statements SET linked_purchase_ids = ? WHERE id = ?",
        [nextValue, row.id]
      );
    }
    fixedCount += 1;
  }

  if (fixedCount === 0) {
    console.log("No malformed purchase tokens like P356 found in statements.");
  } else {
    console.log(`${dryRun ? "[dry-run] Would fix" : "Fixed"} ${fixedCount} statement token row(s).`);
  }
  return fixedCount;
}

function getPurchaseTarget(token) {
  const prefix = token.slice(0, 2);
  return PURCHASE_TARGETS[prefix] || null;
}

async function syncPurchaseStatementLinks(conn) {
  const [statements] = await conn.execute(`
    SELECT id, trans_id, linked_purchase_ids
    FROM statements
    WHERE linked_purchase_ids IS NOT NULL
      AND TRIM(linked_purchase_ids) <> ''
      AND TRIM(linked_purchase_ids) <> 'null'
  `);

  console.log(`Found ${statements.length} statement(s) with linked purchases.`);

  let purchaseUpdates = 0;
  let mergedValues = 0;
  let skippedMissingPurchase = 0;
  let multiPurchaseStatements = 0;

  for (const stmt of statements) {
    const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
    const ppPsTokens = tokens.filter((token) => token.startsWith("PP") || token.startsWith("PS"));
    if (ppPsTokens.length === 0) continue;

    if (ppPsTokens.length > 1) {
      multiPurchaseStatements += 1;
      console.log(
        `Statement #${stmt.id} links ${ppPsTokens.length} purchase(s): ${ppPsTokens.join(", ")}`
      );
    }

    const valuesToAdd = buildValuesToAdd(stmt, storeMode);
    if (valuesToAdd.length === 0) continue;

    for (const token of ppPsTokens) {
      const target = getPurchaseTarget(token);
      if (!target || !target.enabled) continue;

      const purchaseId = Number(token.slice(2));
      if (!Number.isFinite(purchaseId) || purchaseId <= 0) continue;

      const purchaseRow = await fetchPurchaseRow(conn, target.table, purchaseId);

      if (!purchaseRow) {
        skippedMissingPurchase += 1;
        console.warn(
          `Skip statement #${stmt.id}: ${target.label} purchase ${token} not found in ${target.table}`
        );
        continue;
      }

      const existing = parseLinkedStatementIds(purchaseRow.linked_statement_ids);
      const merged = mergeUnique(existing, valuesToAdd);
      const addedCount = merged.length - existing.length;

      if (addedCount === 0) continue;

      mergedValues += addedCount;
      purchaseUpdates += 1;

      const nextJson = JSON.stringify(merged);
      console.log(
        `${dryRun ? "[dry-run] Would update" : "Updating"} ${target.label} purchase #${purchaseId} ` +
          `(statement #${stmt.id}, trans_id=${stmt.trans_id || "—"}): ` +
          `${JSON.stringify(existing)} -> ${nextJson}`
      );

      if (!dryRun) {
        if (!(await columnExists(conn, target.table, "linked_statement_ids"))) {
          await ensureLinkedStatementIdsColumn(conn, target.table);
        }
        await conn.execute(
          `UPDATE ${target.table} SET linked_statement_ids = ? WHERE id = ?`,
          [nextJson, purchaseId]
        );
      }
    }
  }

  console.log("");
  console.log("Summary");
  console.log("-------");
  console.log(`Scope: ${scope}`);
  console.log(`Mode: ${storeMode}`);
  console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
  console.log(`Statements with 2+ purchases: ${multiPurchaseStatements}`);
  console.log(`Purchase rows updated: ${purchaseUpdates}`);
  console.log(`Values merged: ${mergedValues}`);
  console.log(`Missing purchases skipped: ${skippedMissingPurchase}`);
}

async function main() {
  if (!["trans_id", "statement-id", "both"].includes(storeMode)) {
    console.error("Invalid --store value. Use trans_id, statement-id, or both.");
    process.exit(1);
  }
  if (!["product", "spare", "all"].includes(scope)) {
    console.error("Invalid --scope value. Use product, spare, or all.");
    process.exit(1);
  }

  const conn = await getDbConnection();

  try {
    console.log("Starting safe purchase-statement link sync...");
    console.log(`Database: ${process.env.DB_NAME || "dynaclean_crm1"}`);
    console.log("");

    if (PURCHASE_TARGETS.PP.enabled) {
      await ensureLinkedStatementIdsColumn(conn, PURCHASE_TARGETS.PP.table);
    }
    if (PURCHASE_TARGETS.PS.enabled) {
      await ensureLinkedStatementIdsColumn(conn, PURCHASE_TARGETS.PS.table);
    }

    if (fixTokens) {
      await fixMalformedStatementTokens(conn);
      console.log("");
    } else {
      console.log("Skipping malformed token fix (--no-fix-tokens).");
      console.log("");
    }

    await syncPurchaseStatementLinks(conn);
    console.log("");
    console.log("Done.");
  } catch (error) {
    console.error("Sync failed:", error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
