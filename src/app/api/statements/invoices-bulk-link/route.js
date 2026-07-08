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

      // Now recalculate paid_amount for all selected invoices, taking into account ALL statements still linked to them!
      // We should distribute the SELECTED statements that we just linked to the invoices
      console.log(`[invoices-bulk-link] selectedStatementIdsSet has ${selectedStatementIdsSet.size} statements: ${JSON.stringify(Array.from(selectedStatementIdsSet))}`);
      
      // Include BOTH newly selected AND initially linked statements for distribution
      const allStatementIdsToDistribute = new Set([
        ...selectedStatementIdsSet,
        ...Array.from(initial_linked_statement_ids || [])
      ]);
      
      console.log(`[invoices-bulk-link] Total statements to distribute (selected + initial): ${allStatementIdsToDistribute.size}: ${JSON.stringify(Array.from(allStatementIdsToDistribute))}`);
      
      // Get the updated selected statements with their new links
      const [selectedStatements] = await conn.query(
        "SELECT id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
        [[...allStatementIdsToDistribute]]
      );

      console.log(`[invoices-bulk-link] Found ${selectedStatements.length} selected statements to distribute`);

      // Sort statements by ID (older first)
      const statementsToDistribute = selectedStatements.sort((a, b) => a.id - b.id);

      // Get all selected invoices with their grand_total and current amount_paid
      const [invoices] = await conn.query(
        "SELECT id, grand_total, amount_paid FROM invoices WHERE id IN (?)",
        [invoice_ids]
      );

      // Sort invoices by ID (ascending)
      const sortedInvoices = invoices.sort((a, b) => a.id - b.id);

      console.log(`[invoices-bulk-link] Found ${sortedInvoices.length} invoices: ID=123, grandTotal=₹43660.00, amountPaid=₹5000.00 | ID=124, grandTotal=₹164020.00, amountPaid=₹80000.00 ${sortedInvoices.map(inv => `ID=${inv.id}, grandTotal=₹${inv.grand_total}, amountPaid=₹${inv.amount_paid}`).join(' | ')}`);

      // Create a map to track amount paid for each invoice
      const invoicePaidMap = {};
      sortedInvoices.forEach(inv => {
        invoicePaidMap[inv.id] = Number(inv.amount_paid || 0);
      });

      // Distribute SELECTED statements!
      for (const stmt of statementsToDistribute) {
        let remainingToAllocate = Number(stmt.amount || 0);
        
        // Get all tokens linked to this statement
        const stmtTokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        
        console.log(`[invoices-bulk-link] Statement ${stmt.id}: amount=₹${remainingToAllocate}, linkedTokens=${JSON.stringify(stmtTokens)}`);
        
        // Get invoices that are linked to this statement
        const linkedInvoiceIds = stmtTokens
          .filter(token => token.startsWith('IP'))
          .map(token => parseInt(token.substring(2)))
          .filter(id => invoice_ids.includes(id));
        
        console.log(`[invoices-bulk-link] Statement ${stmt.id}: linkedInvoiceIds=${JSON.stringify(linkedInvoiceIds)}`);
        
        // If statement is linked to specific invoices, distribute only to those
        const targetInvoices = linkedInvoiceIds.length > 0
          ? sortedInvoices.filter(inv => linkedInvoiceIds.includes(inv.id))
          : sortedInvoices; // Fallback: distribute to all if not specifically linked
        
        console.log(`[invoices-bulk-link] Statement ${stmt.id}: targetInvoices=${targetInvoices.map(i => i.id).join(',')}`);
        
        for (const invoice of targetInvoices) {
          if (remainingToAllocate <= 0) break;
          const invoiceGrandTotal = Number(invoice.grand_total || 0);
          const alreadyPaid = invoicePaidMap[invoice.id];
          const remainingOnInvoice = Math.max(0, invoiceGrandTotal - alreadyPaid);
          const toAllocate = Math.min(remainingOnInvoice, remainingToAllocate);
          
          if (toAllocate > 0) {
            console.log(`[invoices-bulk-link] Allocating ₹${toAllocate} to invoice ${invoice.id} (grandTotal=₹${invoiceGrandTotal}, alreadyPaid=₹${alreadyPaid}, remainingOnInvoice=₹${remainingOnInvoice})`);
            invoicePaidMap[invoice.id] += toAllocate;
            remainingToAllocate -= toAllocate;
          }
        }
        
        if (remainingToAllocate > 0) {
          console.log(`[invoices-bulk-link] ⚠️ WARNING: Statement ${stmt.id} has ₹${remainingToAllocate} unallocated!`);
        }
      }

      // Update invoices with new amount_paid and balance_amount
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

        console.log(`[invoices-bulk-link] Updating invoice ${invoice.id}: amountPaid=${newAmountPaid}, balanceAmount=${newBalanceAmount}, status=${paymentStatus}`);

        await conn.execute(
          "UPDATE invoices SET amount_paid = ?, balance_amount = ?, payment_status = ? WHERE id = ?",
          [newAmountPaid, newBalanceAmount, paymentStatus, invoice.id]
        );

        // If invoice just became PAID, create ledger entry
        if (paymentStatus === "PAID" && Number(invoice.amount_paid) < invoiceGrandTotal) {
          // Get the invoice details
          const [[invoiceDetails]] = await conn.execute(
            "SELECT invoice_number, customer_name, created_at FROM invoices WHERE id = ?",
            [invoice.id]
          );

          // Find the trans_id from the statements that are linked to this invoice
          let transId = "";
          for (const stmt of statementsToDistribute) {
            const stmtTokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
            if (stmtTokens.includes(`IP${invoice.id}`)) {
              // Get the trans_id from statements table
              const [[stmtDetails]] = await conn.execute(
                "SELECT trans_id FROM statements WHERE id = ?",
                [stmt.id]
              );
              if (stmtDetails?.trans_id) {
                transId = stmtDetails.trans_id;
                break;
              }
            }
          }

          // Create ledger entry for payment received
          const ledgerAmount = newAmountPaid - Number(invoice.amount_paid || 0); // Only the newly added payment
          if (ledgerAmount > 0) {
            await conn.execute(
              `INSERT INTO ledger_entries (entry_date, particulars, vch_type, vch_no, debit, credit, buyer_name)
               VALUES (NOW(), ?, ?, ?, ?, ?, ?)`,
              [
                `Payment received against Invoice #${invoiceDetails?.invoice_number || invoice.id}`,
                "Payment",
                transId || invoiceDetails?.invoice_number || `INV${invoice.id}`,
                0, // debit
                ledgerAmount, // credit
                invoiceDetails?.customer_name || null
              ]
            );
            console.log(`[invoices-bulk-link] ✅ Created ledger entry for paid invoice ${invoice.id}: amount=₹${ledgerAmount}, transId=${transId}`);
          }
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
