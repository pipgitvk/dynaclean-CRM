import { getDbConnection } from "@/lib/db";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

export async function POST(request) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const body = await request.json();
    let { statementIds, statementId, purchaseIds, initialLinkedStatementIds = [] } = body;

    console.log("[spare-purchases-bulk-link] Received body:", body);

    // Handle both singular and plural statement ID
    if (statementId && !statementIds) {
      statementIds = [statementId];
    }

    // Convert all IDs to numbers
    statementIds = (statementIds || []).map(id => Number(id));
    purchaseIds = purchaseIds.map(id => Number(id));
    initialLinkedStatementIds = (initialLinkedStatementIds || []).map(id => Number(id));

    console.log("[spare-purchases-bulk-link] Processed statementIds:", statementIds);
    console.log("[spare-purchases-bulk-link] Processed purchaseIds:", purchaseIds);

    if (!Array.isArray(purchaseIds) || purchaseIds.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await conn.beginTransaction();

    try {
      // 0. Set parent-child relationship for selected purchases (if more than one)
      console.log(`[spare-purchases-bulk-link] purchaseIds.length: ${purchaseIds.length}`);
      if (purchaseIds.length > 1) {
        // Sort in descending order to get highest id as parent
        const sortedIds = [...purchaseIds].sort((a, b) => b - a);
        const parentId = sortedIds[0];
        const childIds = sortedIds.slice(1);

        console.log(`[spare-purchases-bulk-link] Parent ID: ${parentId}, Child IDs: ${childIds.join(", ")}`);

        // Set parent_id for children
        for (const childId of childIds) {
          const [updateResult] = await conn.execute(
            "UPDATE spare_stock_request SET parent_id = ? WHERE id = ?",
            [parentId, childId]
          );
          console.log(`[spare-purchases-bulk-link] Updated child ${childId}: affectedRows: ${updateResult.affectedRows}`);
        }

        // Ensure parent has no parent_id
        const [parentUpdateResult] = await conn.execute(
          "UPDATE spare_stock_request SET parent_id = NULL WHERE id = ?",
          [parentId]
        );
        console.log(`[spare-purchases-bulk-link] Updated parent ${parentId}: affectedRows: ${parentUpdateResult.affectedRows}`);

        console.log(`[spare-purchases-bulk-link] Set parent_id: ${parentId} is parent of ${childIds.join(", ")}`);
      }

      // Now reset paid_amount to 0 for all selected purchases to recalculate from scratch!
      for (const purchaseId of purchaseIds) {
        await conn.execute("UPDATE spare_stock_request SET paid_amount = 0 WHERE id = ?", [purchaseId]);
      }

      // Now, process ALL statements!
      const relevantStatementIds = new Set([
        ...(statementIds || []),
        ...initialLinkedStatementIds]);
      const selectedStatementIdsSet = new Set(statementIds || []);
      const selectedPurchaseTokens = new Set(purchaseIds.map(id => `SP${id}`));

      // Get all relevant statements
      const [relevantStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
        [[...relevantStatementIds]]
      );

      // Update statements: for each relevant statement
      for (const stmt of relevantStatements) {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        let nextTokens = [...tokens];
        if (selectedStatementIdsSet.has(stmt.id)) {
          purchaseIds.forEach(id => {
            const token = `SP${id}`;
            if (!nextTokens.includes(token)) {
              nextTokens.push(token);
            }
          });
        } else {
          // remove selected purchases
          nextTokens = nextTokens.filter(t => !selectedPurchaseTokens.has(t));
        }
        const nextLinkedIds = nextTokens.length > 0 ? JSON.stringify(nextTokens) : null;
        const nextStatus = nextTokens.length > 0 ? "Settled" : "Unsettled";
        await conn.execute("UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?", [nextLinkedIds, nextStatus, stmt.id]);
      }

      // Now, recalculate paid_amount for all selected purchases!
      // First, get all statements again to see which are still linked to selected purchases!
      const [allStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE linked_purchase_ids IS NOT NULL OR linked_purchase_ids != ''"
      );

      const statementsToDistribute = [];
      allStatements.forEach(stmt => {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        const hasRelevantPurchase = tokens.some(t => selectedPurchaseTokens.has(t));
        if (hasRelevantPurchase) {
          statementsToDistribute.push(stmt);
        }
      });

      // Sort statements by ID
      statementsToDistribute.sort((a, b) => a.id - b.id);

      // Get all selected purchases!
      const [purchases] = await conn.query(
        "SELECT id, net_amount FROM spare_stock_request WHERE id IN (?)",
        [purchaseIds]
      );

      // Sort purchases!
      const parentId = Math.max(...purchases.map(p => p.id));
      const children = purchases.filter(p => p.id !== parentId);
      const sortedChildren = children.sort((a, b) => a.id - b.id);
      const sortedPurchases = [...sortedChildren, ...purchases.filter(p => p.id === parentId)];

      // Distribute statements to purchases!
      const purchasePaid = {};
      sortedPurchases.forEach(p => purchasePaid[p.id] = 0);
      for (const stmt of statementsToDistribute) {
        let remainingToAllocate = Number(stmt.amount || 0);
        for (const purchase of sortedPurchases) {
          if (remainingToAllocate <= 0) break;
          const netAmount = Number(purchase.net_amount || 0);
          const needed = netAmount - purchasePaid[purchase.id];
          if (needed <= 0) continue;
          const apply = Math.min(needed, remainingToAllocate);
          purchasePaid[purchase.id] += apply;
          remainingToAllocate -= apply;
        }
      }

      // Update DB!
      for (const purchaseId in purchasePaid) {
        await conn.execute("UPDATE spare_stock_request SET paid_amount = ? WHERE id = ?", [purchasePaid[purchaseId], purchaseId]);
      }

      await conn.commit();
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      await conn.rollback();
      throw error;
    }
  } catch (error) {
    console.error("[spare-purchases-bulk-link] ERROR:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}