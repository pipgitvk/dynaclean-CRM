/**
 * Remap statements.linked_purchase_ids from spare tokens (SP/PS) to product tokens (PP)
 * after spare purchases were imported into product_stock_request.
 *
 * Mapping rules (in order):
 *  1. product_stock_request.id = spare row id AND net_amount matches
 *  2. product_stock_request.id = spare row id (fallback)
 *  3. product_stock_request.product_code = spare row id (unique or net_amount match)
 *
 * Then optionally sync product_stock_request.linked_statement_ids.
 *
 * Usage:
 *   node scripts/remap-spare-links-to-product.js --dry-run
 *   node scripts/remap-spare-links-to-product.js
 *   node scripts/remap-spare-links-to-product.js --skip-sync
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const dryRun = process.argv.includes("--dry-run");
const skipSync = process.argv.includes("--skip-sync");

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

function parseLinkedPurchaseIdsFromStatement(rawVal) {
  const out = [];
  for (const value of expandRawValues(rawVal)) {
    const s = String(value).trim().toUpperCase();
    if (!s) continue;
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      out.push(s.startsWith("SP") ? `PS${s.slice(2)}` : s);
      continue;
    }
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

async function buildSpareToProductMap(conn) {
  const map = new Map();
  const [spareRows] = await conn.execute(
    "SELECT id, net_amount FROM spare_stock_request"
  );

  for (const spare of spareRows) {
    const spareRowId = Number(spare.id);
    let productId = null;

    const [sameIdRows] = await conn.execute(
      "SELECT id, net_amount FROM product_stock_request WHERE id = ?",
      [spareRowId]
    );

    if (sameIdRows.length > 0) {
      const exact = sameIdRows.find(
        (row) => Number(row.net_amount) === Number(spare.net_amount)
      );
      productId = exact?.id ?? sameIdRows[0].id;
    } else {
      const [byCodeRows] = await conn.execute(
        "SELECT id, net_amount FROM product_stock_request WHERE TRIM(CAST(product_code AS CHAR)) = ? ORDER BY id DESC",
        [String(spareRowId)]
      );

      if (byCodeRows.length === 1) {
        productId = byCodeRows[0].id;
      } else if (byCodeRows.length > 1) {
        const exact = byCodeRows.find(
          (row) => Number(row.net_amount) === Number(spare.net_amount)
        );
        productId = exact?.id ?? byCodeRows[0].id;
      }
    }

    if (productId) {
      map.set(spareRowId, Number(productId));
    }
  }

  return map;
}

function mapSpareTokenToProductToken(rawToken, spareToProductMap) {
  const s = String(rawToken).trim().toUpperCase();
  if (!s) return { token: s, changed: false, spareRowId: null };

  let spareRowId = null;
  if (/^SP(\d+)$/.test(s)) spareRowId = Number(s.slice(2));
  else if (/^PS(\d+)$/.test(s)) spareRowId = Number(s.slice(2));
  else if (/^P(\d+)$/.test(s)) spareRowId = Number(s.slice(1));
  else if (/^\d+$/.test(s)) spareRowId = Number(s);

  if (spareRowId == null || !Number.isFinite(spareRowId)) {
    return { token: s, changed: false, spareRowId: null };
  }

  const productId = spareToProductMap.get(spareRowId);
  if (!productId) {
    return { token: s, changed: false, spareRowId };
  }

  const nextToken = `PP${productId}`;
  return {
    token: nextToken,
    changed: nextToken !== s,
    spareRowId,
    productId,
  };
}

function remapLinkedPurchaseIds(rawVal, spareToProductMap) {
  const expanded = expandRawValues(rawVal);
  const nextTokens = [];
  let changed = false;

  for (const raw of expanded) {
    const s = String(raw).trim().toUpperCase();
    if (!s) continue;

    if (/^IP\d+$/.test(s)) {
      if (!nextTokens.includes(s)) nextTokens.push(s);
      continue;
    }

    if (/^PP\d+$/.test(s)) {
      if (!nextTokens.includes(s)) nextTokens.push(s);
      continue;
    }

    if (/^(SP|PS|P)\d+$/.test(s) || /^\d+$/.test(s)) {
      const mapped = mapSpareTokenToProductToken(s, spareToProductMap);
      if (mapped.changed) changed = true;
      if (mapped.token && !nextTokens.includes(mapped.token)) {
        nextTokens.push(mapped.token);
      }
      continue;
    }

    if (!nextTokens.includes(s)) nextTokens.push(s);
  }

  if (!changed) {
    return { nextValue: rawVal, changed: false, nextTokens };
  }

  return {
    nextValue: nextTokens.length > 0 ? JSON.stringify(nextTokens) : null,
    changed: true,
    nextTokens,
  };
}

async function remapStatementLinks(conn, spareToProductMap) {
  const [statements] = await conn.execute(`
    SELECT id, trans_id, linked_purchase_ids
    FROM statements
    WHERE linked_purchase_ids IS NOT NULL
      AND TRIM(linked_purchase_ids) <> ''
      AND TRIM(linked_purchase_ids) <> 'null'
      AND (
        linked_purchase_ids LIKE '%SP%'
        OR linked_purchase_ids LIKE '%PS%'
        OR linked_purchase_ids REGEXP '"P[0-9]+"'
      )
  `);

  let updatedStatements = 0;
  let mappedTokens = 0;
  let unmappedTokens = 0;

  for (const stmt of statements) {
    const { nextValue, changed, nextTokens } = remapLinkedPurchaseIds(
      stmt.linked_purchase_ids,
      spareToProductMap
    );
    if (!changed) continue;

    updatedStatements += 1;
    mappedTokens += nextTokens.length;

    console.log(
      `${dryRun ? "[dry-run] Would update" : "Updating"} statement #${stmt.id} ` +
        `(trans_id=${stmt.trans_id || "—"}): ${stmt.linked_purchase_ids} -> ${nextValue}`
    );

    if (!dryRun) {
      await conn.execute(
        "UPDATE statements SET linked_purchase_ids = ? WHERE id = ?",
        [nextValue, stmt.id]
      );
    }
  }

  console.log("");
  console.log(`Statements ${dryRun ? "to update" : "updated"}: ${updatedStatements}`);
  console.log(`Mapped tokens: ${mappedTokens}`);

  return { updatedStatements, mappedTokens, unmappedTokens };
}

async function syncProductLinkedStatementIds(conn) {
  const [statements] = await conn.execute(`
    SELECT id, trans_id, linked_purchase_ids
    FROM statements
    WHERE linked_purchase_ids IS NOT NULL
      AND TRIM(linked_purchase_ids) <> ''
      AND TRIM(linked_purchase_ids) <> 'null'
  `);

  let purchaseUpdates = 0;
  let mergedValues = 0;

  for (const stmt of statements) {
    const tokens = parseLinkedPurchaseIdsFromStatement(stmt.linked_purchase_ids).filter((t) =>
      t.startsWith("PP")
    );
    if (tokens.length === 0) continue;

    const transId =
      stmt.trans_id != null && String(stmt.trans_id).trim() !== ""
        ? String(stmt.trans_id).trim()
        : null;
    if (!transId) continue;

    for (const token of tokens) {
      const purchaseId = Number(token.slice(2));
      if (!Number.isFinite(purchaseId) || purchaseId <= 0) continue;

      const [rows] = await conn.execute(
        "SELECT id, linked_statement_ids FROM product_stock_request WHERE id = ?",
        [purchaseId]
      );
      if (rows.length === 0) continue;

      const existing = parseLinkedStatementIds(rows[0].linked_statement_ids);
      const merged = mergeUnique(existing, [transId]);
      if (merged.length === existing.length) continue;

      purchaseUpdates += 1;
      mergedValues += merged.length - existing.length;

      const nextJson = JSON.stringify(merged);
      console.log(
        `${dryRun ? "[dry-run] Would update" : "Updating"} product purchase #${purchaseId} ` +
          `(statement #${stmt.id}): ${JSON.stringify(existing)} -> ${nextJson}`
      );

      if (!dryRun) {
        await conn.execute(
          "UPDATE product_stock_request SET linked_statement_ids = ? WHERE id = ?",
          [nextJson, purchaseId]
        );
      }
    }
  }

  console.log("");
  console.log(`Product rows ${dryRun ? "to update" : "updated"}: ${purchaseUpdates}`);
  console.log(`Merged trans_id values: ${mergedValues}`);
}

async function main() {
  const conn = await getDbConnection();

  try {
    console.log("Remap spare statement links -> product purchase links");
    console.log(`Database: ${process.env.DB_NAME || "dynaclean_crm1"}`);
    console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
    console.log("");

    const spareToProductMap = await buildSpareToProductMap(conn);
    console.log(`Built spare->product map for ${spareToProductMap.size} spare row(s).`);
    console.log("Sample mappings:");
    [...spareToProductMap.entries()].slice(0, 8).forEach(([spareId, productId]) => {
      console.log(`  SP${spareId} / PS${spareId} -> PP${productId}`);
    });
    console.log("");

    await remapStatementLinks(conn, spareToProductMap);

    if (!skipSync) {
      console.log("");
      console.log("Syncing product_stock_request.linked_statement_ids...");
      console.log("");
      await syncProductLinkedStatementIds(conn);
    }

    console.log("");
    console.log("Done.");
  } catch (error) {
    console.error("Remap failed:", error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();