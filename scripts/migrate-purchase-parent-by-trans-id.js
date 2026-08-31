/**
 * Set product_stock_request parent/child rows by shared statement trans_id.
 *
 * Rule: purchases that share the same trans_id in linked_statement_ids
 * belong to one family — lowest id becomes parent, others become children.
 *
 * Usage:
 *   node scripts/migrate-purchase-parent-by-trans-id.js --dry-run
 *   node scripts/migrate-purchase-parent-by-trans-id.js
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const dryRun = process.argv.includes("--dry-run");

async function getDbConnection() {
  return mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "dynaclean_crm1",
  });
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

function buildParentChildPlan(rows) {
  const transIdToPurchaseIds = new Map();

  for (const row of rows) {
    const purchaseId = Number(row.id);
    if (!Number.isFinite(purchaseId) || purchaseId <= 0) continue;

    const transIds = parseLinkedStatementIds(row.linked_statement_ids);
    for (const transId of transIds) {
      if (!transIdToPurchaseIds.has(transId)) {
        transIdToPurchaseIds.set(transId, new Set());
      }
      transIdToPurchaseIds.get(transId).add(purchaseId);
    }
  }

  const childToParent = new Map();
  const families = [];

  for (const [transId, idSet] of transIdToPurchaseIds.entries()) {
    const purchaseIds = [...idSet].sort((a, b) => a - b);
    if (purchaseIds.length < 2) continue;

    const parentId = purchaseIds[0];
    const children = purchaseIds.slice(1);

    families.push({ transId, parentId, children, purchaseIds });

    for (const childId of children) {
      const existingParent = childToParent.get(childId);
      if (existingParent == null || parentId < existingParent) {
        childToParent.set(childId, parentId);
      }
    }
  }

  const rootIds = new Set();
  for (const family of families) {
    if (!childToParent.has(family.parentId)) {
      rootIds.add(family.parentId);
    }
  }

  return { childToParent, families, rootIds };
}

async function main() {
  const conn = await getDbConnection();

  try {
    console.log("Migrate product purchase parent_id by shared statement trans_id");
    console.log(`Database: ${process.env.DB_NAME || "dynaclean_crm1"}`);
    console.log(`Dry run: ${dryRun ? "yes" : "no"}`);
    console.log("");

    const [rows] = await conn.execute(`
      SELECT id, parent_id, linked_statement_ids
      FROM product_stock_request
      WHERE linked_statement_ids IS NOT NULL
        AND TRIM(linked_statement_ids) <> ''
        AND TRIM(linked_statement_ids) <> 'null'
      ORDER BY id ASC
    `);

    const { childToParent, families, rootIds } = buildParentChildPlan(rows);

    console.log(`Found ${families.length} trans_id group(s) with 2+ purchases.`);
    console.log("");

    for (const family of families) {
      console.log(
        `trans_id=${family.transId} -> parent #${family.parentId}, children [${family.children.join(", ")}]`
      );
    }

    console.log("");
    let parentClears = 0;
    let childUpdates = 0;
    let unchanged = 0;

    for (const rootId of [...rootIds].sort((a, b) => a - b)) {
      const current = rows.find((row) => Number(row.id) === rootId);
      const currentParentId =
        current?.parent_id == null || current?.parent_id === ""
          ? null
          : Number(current.parent_id);

      if (currentParentId == null) {
        unchanged += 1;
        continue;
      }

      parentClears += 1;
      console.log(
        `${dryRun ? "[dry-run] Would clear" : "Clearing"} parent_id on root purchase #${rootId}`
      );

      if (!dryRun) {
        await conn.execute(
          "UPDATE product_stock_request SET parent_id = NULL WHERE id = ?",
          [rootId]
        );
      }
    }

    for (const [childId, parentId] of [...childToParent.entries()].sort(
      (a, b) => a[0] - b[0]
    )) {
      const current = rows.find((row) => Number(row.id) === childId);
      const currentParentId =
        current?.parent_id == null || current?.parent_id === ""
          ? null
          : Number(current.parent_id);

      if (currentParentId === parentId) {
        unchanged += 1;
        continue;
      }

      childUpdates += 1;
      console.log(
        `${dryRun ? "[dry-run] Would set" : "Setting"} purchase #${childId} parent_id = #${parentId}` +
          (currentParentId != null ? ` (was #${currentParentId})` : "")
      );

      if (!dryRun) {
        await conn.execute(
          "UPDATE product_stock_request SET parent_id = ? WHERE id = ?",
          [parentId, childId]
        );
      }
    }

    console.log("");
    console.log("Summary");
    console.log("-------");
    console.log(`Families processed: ${families.length}`);
    console.log(`Root rows cleared: ${parentClears}`);
    console.log(`Child rows updated: ${childUpdates}`);
    console.log(`Already correct: ${unchanged}`);
    console.log("");
    console.log("Done.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main();
