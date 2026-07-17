import { getDbConnection } from "@/lib/db";
import { parseLinkedPurchaseTokens } from "@/lib/statementLinkedPurchases";

export async function PATCH(req) {
  const pool = await getDbConnection();
  const conn = await pool.getConnection();

  try {
    const { invoice_ids, statement_ids, initial_linked_statement_ids = [] } = await req.json();

    console.log(`[invoices-bulk-link] PATCH Request: invoice_ids=${JSON.stringify(invoice_ids)}, statement_ids=${JSON.stringify(statement_ids)}, initial_linked=${JSON.stringify(initial_linked_statement_ids)}`);

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

      // Now recalculate paid_amount FRESH from scratch — only statements still selected/linked count
      console.log(`[invoices-bulk-link] selectedStatementIdsSet has ${selectedStatementIdsSet.size} statements: ${JSON.stringify(Array.from(selectedStatementIdsSet))}`);
      
      // Only distribute SELECTED (currently linked) statements — NOT initial_linked ones that may have been unlinked
      const allStatementIdsToDistribute = new Set([...selectedStatementIdsSet]);
      
      console.log(`[invoices-bulk-link] Statements to distribute: ${allStatementIdsToDistribute.size}: ${JSON.stringify(Array.from(allStatementIdsToDistribute))}`);

      let statementsToDistribute = [];
      if (allStatementIdsToDistribute.size > 0) {
        const [selectedStatements] = await conn.query(
          "SELECT id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
          [[...allStatementIdsToDistribute]]
        );
        statementsToDistribute = selectedStatements.sort((a, b) => a.id - b.id);
      }

      console.log(`[invoices-bulk-link] Found ${statementsToDistribute.length} statements to distribute`);

      // Get all selected invoices with their grand_total
      const [invoices] = await conn.query(
        "SELECT id, grand_total, amount_paid, linked_trans_ids FROM invoices WHERE id IN (?)",
        [invoice_ids]
      );

      const sortedInvoices = invoices.sort((a, b) => a.id - b.id);

      // START FROM ZERO — recalculate amount_paid fresh from currently linked statements only
      const invoicePaidMap = {};
      sortedInvoices.forEach(inv => {
        invoicePaidMap[inv.id] = 0; // reset to 0, not from DB
      });

      // Distribute selected statements across invoices
      for (const stmt of statementsToDistribute) {
        let remainingToAllocate = Number(stmt.amount || 0);
        
        const stmtTokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        console.log(`[invoices-bulk-link] Statement ${stmt.id}: amount=₹${remainingToAllocate}, tokens=${JSON.stringify(stmtTokens)}`);
        
        const linkedInvoiceIds = stmtTokens
          .filter(token => token.startsWith('IP'))
          .map(token => parseInt(token.substring(2)))
          .filter(id => invoice_ids.includes(id));
        
        const targetInvoices = linkedInvoiceIds.length > 0
          ? sortedInvoices.filter(inv => linkedInvoiceIds.includes(inv.id))
          : sortedInvoices;
        
        for (const invoice of targetInvoices) {
          if (remainingToAllocate <= 0) break;
          const invoiceGrandTotal = Number(invoice.grand_total || 0);
          const alreadyPaid = invoicePaidMap[invoice.id];
          const remainingOnInvoice = Math.max(0, invoiceGrandTotal - alreadyPaid);
          const toAllocate = Math.min(remainingOnInvoice, remainingToAllocate);
          
          if (toAllocate > 0) {
            invoicePaidMap[invoice.id] += toAllocate;
            remainingToAllocate -= toAllocate;
          }
        }
      }

      // Update invoices with new amount_paid and balance_amount
      // Build map: invoiceId -> Set of trans_ids from SELECTED (linked) statements
      const invoiceTransIdsMap = {};
      invoice_ids.forEach(id => { invoiceTransIdsMap[id] = new Set(); });

      // For each selected statement, get its trans_id and add to ALL selected invoices
      for (const stmt of statementsToDistribute) {
        if (!selectedStatementIdsSet.has(stmt.id)) continue; // skip unlinked

        const [[stmtRow]] = await conn.execute(
          "SELECT trans_id FROM statements WHERE id = ?",
          [stmt.id]
        );
        const transId = stmtRow?.trans_id;
        console.log(`[invoices-bulk-link] Statement ${stmt.id} trans_id=${transId}`);
        if (transId) {
          invoice_ids.forEach(invId => {
            invoiceTransIdsMap[invId].add(transId);
          });
        }
      }

      for (const invoice of sortedInvoices) {
        const newAmountPaid = invoicePaidMap[invoice.id];
        const invoiceGrandTotal = Number(invoice.grand_total || 0);
        const newBalanceAmount = Math.max(0, invoiceGrandTotal - newAmountPaid);
        
        // Determine payment status based on balance amount
        let paymentStatus = "UNPAID";
        if (newBalanceAmount === 0 && invoiceGrandTotal > 0) {
          paymentStatus = "PAID";
        } else if (newBalanceAmount > 0 && newBalanceAmount < invoiceGrandTotal) {
          paymentStatus = "PARTIAL";
        }

        // linked_trans_ids = only trans_ids from currently selected statements (clean set, no merging old ones)
        const linkedTransIdsJson = invoiceTransIdsMap[invoice.id].size > 0
          ? JSON.stringify([...invoiceTransIdsMap[invoice.id]])
          : null;

        console.log(`[invoices-bulk-link] Invoice ${invoice.id}: linked_trans_ids=${linkedTransIdsJson}, amountPaid=${newAmountPaid}, balance=${newBalanceAmount}, status=${paymentStatus}`);

        await conn.execute(
          "UPDATE invoices SET amount_paid = ?, balance_amount = ?, payment_status = ?, linked_trans_ids = ? WHERE id = ?",
          [newAmountPaid, newBalanceAmount, paymentStatus, linkedTransIdsJson, invoice.id]
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
    console.error(`[invoices-bulk-link] ERROR:`, e?.message || e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  } finally {
    conn.release();
  }
}
