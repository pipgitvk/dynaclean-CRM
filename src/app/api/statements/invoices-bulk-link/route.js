import { getDbConnection } from "@/lib/db";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

export async function PATCH(req) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { invoice_ids, statement_ids, initial_linked_statement_ids = [] } = await req.json();

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "No invoice IDs provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Ensure parent_id column exists in invoices table
    try {
      await conn.execute("SELECT parent_id FROM invoices LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoices ADD COLUMN parent_id INT UNSIGNED NULL AFTER id");
        await conn.execute("ALTER TABLE invoices ADD INDEX idx_parent_id (parent_id)");
        console.log("✅ Created parent_id column in invoices table");
      } catch (createErr) {
        console.warn("Warning: Could not create parent_id column:", createErr?.message);
      }
    }

    await conn.beginTransaction();

    try {
      // 0. Set parent-child relationship based on highest ID
      // Parent = highest ID, Children = all others
      console.log(`[invoices-bulk-link] invoice_ids.length: ${invoice_ids.length}`);
      if (invoice_ids.length > 1) {
        // Sort in descending order to get highest id as parent
        const sortedIds = [...invoice_ids].sort((a, b) => b - a);
        const parentId = sortedIds[0];
        const childIds = sortedIds.slice(1);

        console.log(`[invoices-bulk-link] Parent ID: ${parentId}, Child IDs: ${childIds.join(", ")}`);

        // Set parent_id for children
        for (const childId of childIds) {
          const [updateResult] = await conn.execute(
            "UPDATE invoices SET parent_id = ? WHERE id = ?",
            [parentId, childId]
          );
          console.log(`[invoices-bulk-link] Updated child ${childId}: affectedRows: ${updateResult.affectedRows}`);
        }

        // Ensure parent has no parent_id
        const [parentUpdateResult] = await conn.execute(
          "UPDATE invoices SET parent_id = NULL WHERE id = ?",
          [parentId]
        );
        console.log(`[invoices-bulk-link] Updated parent ${parentId}: affectedRows: ${parentUpdateResult.affectedRows}`);

        console.log(`[invoices-bulk-link] Set parent_id: ${parentId} is parent of ${childIds.join(", ")}`);
      }

      // 1. Link selected statements to selected invoices
      const selectedInvoiceTokens = new Set(invoice_ids.map(id => `IP${id}`));

      // Now, process ALL statements (selected + non-selected) that are linked to these invoices
      const relevantStatementIds = new Set([
        ...(statement_ids || []),
        ...(initial_linked_statement_ids || [])
      ]);

      // Get all relevant statements
      const [relevantStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
        [[...relevantStatementIds]]
      );

      if (!relevantStatements || relevantStatements.length === 0) {
        console.log(`[invoices-bulk-link] No relevant statements found for IDs:`, [...relevantStatementIds]);
        await conn.commit();
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Split into:
      // A) Selected statements (should be linked to all selected invoices)
      // B) Non-selected statements that were initially linked (should be unlinked from selected invoices)
      const selectedStatementIdsSet = new Set(statement_ids || []);

      for (const stmt of relevantStatements) {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        let nextTokens = [...tokens];
        
        if (selectedStatementIdsSet.has(stmt.id)) {
          // Selected statement: add all selected invoices if not already present
          invoice_ids.forEach(id => {
            const token = `IP${id}`;
            if (!nextTokens.includes(token)) {
              nextTokens.push(token);
            }
          });
        } else {
          // Non-selected statement: remove all selected invoices
          nextTokens = nextTokens.filter(t => !selectedInvoiceTokens.has(t));
        }

        // Update statement
        const nextLinkedIds = nextTokens.length > 0 ? JSON.stringify(nextTokens) : null;
        const nextStatus = nextTokens.length > 0 ? "Settled" : "Unsettled";
        await conn.execute(
          "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ? WHERE id = ?",
          [nextLinkedIds, nextStatus, stmt.id]
        );
      }

      // Now recalculate paid_amount for all selected invoices, taking into account ALL statements still linked to them!
      // First, get all statements again (to get updated links)
      const [updatedStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE linked_purchase_ids IS NOT NULL OR linked_purchase_ids != ''"
      );

      // First, collect all statements that are still linked to any selected invoice
      const statementsToDistribute = [];
      updatedStatements.forEach(stmt => {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        const hasRelevantInvoice = tokens.some(t => selectedInvoiceTokens.has(t));
        if (hasRelevantInvoice) {
          statementsToDistribute.push(stmt);
        }
      });

      // Sort statements by ID (older first)
      statementsToDistribute.sort((a, b) => a.id - b.id);

      // Get all selected invoices with their grand_total
      const [invoices] = await conn.query(
        "SELECT id, grand_total FROM invoices WHERE id IN (?)",
        [invoice_ids]
      );

      // Sort invoices by ID (ascending)
      const sortedInvoices = invoices.sort((a, b) => a.id - b.id);

      // Distribute all relevant statements!
      for (const stmt of statementsToDistribute) {
        let remainingToAllocate = Number(stmt.amount || 0);
        for (const invoice of sortedInvoices) {
          if (remainingToAllocate <= 0) break;
          const total = Number(invoice.grand_total || 0);
          // Just check allocation logic without storing
          remainingToAllocate -= Math.min(total, remainingToAllocate);
        }
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
    console.error(`[invoices-bulk-link] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}
