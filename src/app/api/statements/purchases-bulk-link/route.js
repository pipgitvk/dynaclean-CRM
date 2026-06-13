import { getDbConnection } from "@/lib/db";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

export async function PATCH(req) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { purchase_ids, statement_ids, initial_linked_statement_ids = [] } = await req.json();

    if (!purchase_ids || !Array.isArray(purchase_ids) || purchase_ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No purchase IDs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await conn.beginTransaction();

    try {
      // 0. Set parent-child relationship for selected purchases (if more than one)
      console.log(`[purchases-bulk-link] purchase_ids.length: ${purchase_ids.length}`);
      if (purchase_ids.length > 1) {
        // Sort in descending order to get highest id as parent
        const sortedIds = [...purchase_ids].sort((a, b) => b - a);
        const parentId = sortedIds[0];
        const childIds = sortedIds.slice(1);

        console.log(`[purchases-bulk-link] Parent ID: ${parentId}, Child IDs: ${childIds.join(", ")}`);

        // Set parent_id for children
        for (const childId of childIds) {
          const [updateResult] = await conn.execute(
            "UPDATE product_stock_request SET parent_id = ? WHERE id = ?",
            [parentId, childId]
          );
          console.log(`[purchases-bulk-link] Updated child ${childId}: affectedRows: ${updateResult.affectedRows}`);
        }

        // Ensure parent has no parent_id
        const [parentUpdateResult] = await conn.execute(
          "UPDATE product_stock_request SET parent_id = NULL WHERE id = ?",
          [parentId]
        );
        console.log(`[purchases-bulk-link] Updated parent ${parentId}: affectedRows: ${parentUpdateResult.affectedRows}`);

        console.log(`[purchases-bulk-link] Set parent_id: ${parentId} is parent of ${childIds.join(", ")}`);
      }

      // 1. Reset paid_amount for all selected purchases to recalculate from scratch
      // First, get all statements linked to any of these purchases, to exclude them from initial paid amount
      const [allRelevantStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE linked_purchase_ids IS NOT NULL OR linked_purchase_ids != ''"
      );
      
      const selectedPurchaseTokens = new Set(purchase_ids.map(id => `PP${id}`));
      const purchasePaidAmounts = {};
      purchase_ids.forEach(id => purchasePaidAmounts[id] = 0);

      // First, calculate paid amount from statements NOT selected
      allRelevantStatements.forEach(stmt => {
        if (statement_ids.includes(stmt.id)) return; // Skip selected statements for now
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        const hasRelevantPurchase = tokens.some(t => selectedPurchaseTokens.has(t));
        if (hasRelevantPurchase) {
          // Distribute this statement's amount across relevant purchases (we'll just add to all for now, but better to recalculate properly)
          // Wait, actually, to make it simple, let's reset paid_amount to 0, then recalculate everything!
          // Let's first reset all paid_amounts to 0!
        }
      });

      // Reset paid_amount to 0 for all selected purchases
      for (const purchaseId of purchase_ids) {
        await conn.execute(
          "UPDATE product_stock_request SET paid_amount = 0 WHERE id = ?",
          [purchaseId]
        );
      }

      // Now, process ALL statements (selected + non-selected) that are linked to these purchases
      const relevantStatementIds = new Set([
        ...(statement_ids || []),
        ...(initial_linked_statement_ids || [])
      ]);

      // Get all relevant statements
      const [relevantStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
        [[...relevantStatementIds]]
      );

      // Split into:
      // A) Selected statements (should be linked to all selected purchases)
      // B) Non-selected statements that were initially linked (should be unlinked from selected purchases)
      const selectedStatementIdsSet = new Set(statement_ids || []);

      for (const stmt of relevantStatements) {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        let nextTokens = [...tokens];
        
        if (selectedStatementIdsSet.has(stmt.id)) {
          // Selected statement: add all selected purchases if not already present
          purchase_ids.forEach(id => {
            const token = `PP${id}`;
            if (!nextTokens.includes(token)) {
              nextTokens.push(token);
            }
          });
        } else {
          // Non-selected statement: remove all selected purchases
          nextTokens = nextTokens.filter(t => !selectedPurchaseTokens.has(t));
        }

        // Update statement
        const nextLinkedIds = nextTokens.length > 0 ? JSON.stringify(nextTokens) : null;
        const nextStatus = nextTokens.length > 0 ? "Settled" : "Unsettled";
        await conn.execute(
          "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?",
          [nextLinkedIds, nextStatus, stmt.id]
        );
      }

      // Now recalculate paid_amount for all selected purchases, taking into account ALL statements still linked to them!
      // First, get all statements again (to get updated links)
      const [updatedStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE linked_purchase_ids IS NOT NULL OR linked_purchase_ids != ''"
      );

      // First, collect all statements that are still linked to any selected purchase
      const statementsToDistribute = [];
      updatedStatements.forEach(stmt => {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        const hasRelevantPurchase = tokens.some(t => selectedPurchaseTokens.has(t));
        if (hasRelevantPurchase) {
          statementsToDistribute.push(stmt);
        }
      });

      // Sort statements by ID (older first)
      statementsToDistribute.sort((a, b) => a.id - b.id);

      // Get all selected purchases with their net_amount
      const [purchases] = await conn.query(
        "SELECT id, net_amount FROM product_stock_request WHERE id IN (?)",
        [purchase_ids]
      );

      // Sort purchases: children first (ascending ID), then parent (highest ID)
      const parentId = Math.max(...purchases.map(p => p.id));
      const children = purchases.filter(p => p.id !== parentId);
      const sortedChildren = children.sort((a, b) => a.id - b.id);
      const sortedPurchases = [...sortedChildren, ...purchases.filter(p => p.id === parentId)];

      // Reset paid_amount again (just to be safe)
      const purchasePaid = {};
      sortedPurchases.forEach(p => purchasePaid[p.id] = 0);

      // Distribute all relevant statements!
      for (const stmt of statementsToDistribute) {
        let remainingToAllocate = Number(stmt.amount || 0);
        for (const purchase of sortedPurchases) {
          if (remainingToAllocate <= 0) break;
          const net = Number(purchase.net_amount || 0);
          const needed = net - purchasePaid[purchase.id];
          if (needed <= 0) continue;
          const apply = Math.min(needed, remainingToAllocate);
          purchasePaid[purchase.id] += apply;
          remainingToAllocate -= apply;
        }
      }

      // Update paid_amounts in DB
      for (const purchaseId of Object.keys(purchasePaid)) {
        await conn.execute(
          "UPDATE product_stock_request SET paid_amount = ? WHERE id = ?",
          [purchasePaid[purchaseId], purchaseId]
        );
      }

      await conn.commit();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (e) {
    console.error(`[purchase-bulk-link] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}
