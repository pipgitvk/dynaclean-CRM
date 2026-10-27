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

      // Now, process ALL statements (selected + non-selected) that are linked to these invoices
      const relevantStatementIds = new Set([
        ...(statement_ids || []),
        ...(initial_linked_statement_ids || [])
      ]);

      // Get all relevant statements AND PRESERVE ORIGINAL DATA
      const [relevantStatements] = relevantStatementIds.size > 0
        ? await conn.query(
            "SELECT id, trans_id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
            [[...relevantStatementIds]]
          )
        : [[]];

      // Store original linked_purchase_ids before modifying!
      const originalLinkedPurchaseIdsMap = {};
      for (const stmt of relevantStatements) {
        originalLinkedPurchaseIdsMap[stmt.id] = stmt.linked_purchase_ids;
      }

      const selectedStatementIdsSet = new Set(statement_ids || []);
      const initialLinkedStatementIdsSet = new Set(initial_linked_statement_ids || []);
      const noStatementsSelected = selectedStatementIdsSet.size === 0;
      const selectedInvoiceTokens = new Set(invoice_ids.map(id => `IP${id}`));

      // If NO statements are selected at all, reset everything and break parent-child relationship
      if (noStatementsSelected) {
        console.log(`[invoices-bulk-link] No statements selected — resetting all invoices and removing parent-child links`);

        // Unlink any initial_linked statements from these invoices — also clear invoice_number
        for (const stmt of relevantStatements) {
          const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
          const nextTokens = tokens.filter(t => !selectedInvoiceTokens.has(t));
          const nextLinkedIds = nextTokens.length > 0 ? JSON.stringify(nextTokens) : null;
          const nextStatus = nextTokens.length > 0 ? "Settled" : "Unsettled";
          await conn.execute(
            "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ?, invoice_number = NULL WHERE id = ?",
            [nextLinkedIds, nextStatus, stmt.id]
          );
        }

        // Reset all invoices: amount_paid=0, balance_amount=grand_total, status=UNPAID, parent_id=NULL, linked_trans_ids=NULL
        for (const invId of invoice_ids) {
          await conn.execute(
            "UPDATE invoices SET amount_paid = 0, balance_amount = grand_total, payment_status = 'UNPAID', linked_trans_ids = NULL, parent_id = NULL WHERE id = ?",
            [invId]
          );
        }

        await conn.commit();
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (!relevantStatements || relevantStatements.length === 0) {
        console.log(`[invoices-bulk-link] No relevant statements found for IDs:`, [...relevantStatementIds]);
        await conn.commit();
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Fetch invoices early so we have invoice_number for statement linking
      const [invoices] = await conn.query(
        "SELECT id, grand_total, amount_paid, linked_trans_ids, invoice_number FROM invoices WHERE id IN (?)",
        [invoice_ids]
      );

      // Build invoice_number label for linking (e.g. "DYN/2026-27/100" or combined if multiple)
      const linkedInvoiceNumbers = invoices
        .sort((a, b) => a.id - b.id)
        .map(inv => inv.invoice_number)
        .filter(Boolean)
        .join(", ");

      for (const stmt of relevantStatements) {
        const tokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        let nextTokens = [...tokens];
        
        if (selectedStatementIdsSet.has(stmt.id)) {
          // Only add all selected invoices if this is a NEW statement (NOT initially linked)
          if (!initialLinkedStatementIdsSet.has(stmt.id)) {
            // New statement: add all selected invoices if not already present
            invoice_ids.forEach(id => {
              const token = `IP${id}`;
              if (!nextTokens.includes(token)) {
                nextTokens.push(token);
              }
            });
          }
          // For initially linked statements that are still selected: leave their tokens as they were!
        } else {
          // Non-selected statement: remove all selected invoices
          nextTokens = nextTokens.filter(t => !selectedInvoiceTokens.has(t));
        }

        // Update statement — don't change invoice_number for initially linked statements!
        const nextLinkedIds = nextTokens.length > 0 ? JSON.stringify(nextTokens) : null;
        const nextStatus = nextTokens.length > 0 ? "Settled" : "Unsettled";
        
        // Get original invoice_number from DB
        const [[originalStmtRow]] = await conn.execute(
          "SELECT invoice_number FROM statements WHERE id = ?",
          [stmt.id]
        );
        const originalInvoiceNumber = originalStmtRow?.invoice_number || null;
        
        let nextInvoiceNumber;
        if (initialLinkedStatementIdsSet.has(stmt.id) && selectedStatementIdsSet.has(stmt.id)) {
          // Keep original invoice number for existing linked statements
          nextInvoiceNumber = originalInvoiceNumber;
        } else if (selectedStatementIdsSet.has(stmt.id) && !initialLinkedStatementIdsSet.has(stmt.id)) {
          // Set new invoice number only for NEW statements
          nextInvoiceNumber = linkedInvoiceNumbers || null;
        } else {
          // Clear invoice number if unlinked
          nextInvoiceNumber = null;
        }
        
        await conn.execute(
          "UPDATE statements SET linked_purchase_ids = ?, invoice_status = ?, invoice_number = ? WHERE id = ?",
          [nextLinkedIds, nextStatus, nextInvoiceNumber, stmt.id]
        );
      }

      // First, get the CURRENT state of the invoices before any changes!
      const [currentInvoices] = await conn.query(
        "SELECT id, grand_total, amount_paid, linked_trans_ids, invoice_number FROM invoices WHERE id IN (?)",
        [invoice_ids]
      );

      // Now recalculate paid_amount — preserve existing amounts plus add new!
      console.log(`[invoices-bulk-link] selectedStatementIdsSet has ${selectedStatementIdsSet.size} statements: ${JSON.stringify(Array.from(selectedStatementIdsSet))}`);
      
      // All statements: initial linked (that are still selected) + new selected!
      const allStatementIdsToDistribute = new Set([...selectedStatementIdsSet]);
      
      console.log(`[invoices-bulk-link] Statements to distribute: ${allStatementIdsToDistribute.size}: ${JSON.stringify(Array.from(allStatementIdsToDistribute))}`);

      let statementsToDistribute = [];
      if (allStatementIdsToDistribute.size > 0) {
        const [selectedStatements] = await conn.query(
          "SELECT id, trans_id, amount, linked_purchase_ids FROM statements WHERE id IN (?)",
          [[...allStatementIdsToDistribute]]
        );
        statementsToDistribute = selectedStatements.sort((a, b) => a.id - b.id);
      }

      console.log(`[invoices-bulk-link] Found ${statementsToDistribute.length} statements to distribute`);

      const sortedInvoices = currentInvoices.sort((a, b) => a.id - b.id);

      // START WITH EXISTING AMOUNT PAID!
      const invoicePaidMap = {};
      const invoiceTransIdsMap = {};
      sortedInvoices.forEach(inv => {
        invoicePaidMap[inv.id] = Number(inv.amount_paid || 0);
        invoiceTransIdsMap[inv.id] = new Set(parseLinkedPurchaseTokens(inv.linked_trans_ids)); // preserve existing trans_ids!
      });

      // Add initially linked statements (that are still selected) to invoiceTransIdsMap!
      for (const stmt of relevantStatements) {
        if (!initialLinkedStatementIdsSet.has(stmt.id) || !selectedStatementIdsSet.has(stmt.id)) continue;

        // Get which invoices this statement was originally linked to!
        const originalTokens = parseLinkedPurchaseTokens(originalLinkedPurchaseIdsMap[stmt.id]);
        const originalLinkedIds = originalTokens
          .filter(token => token.startsWith('IP'))
          .map(token => parseInt(token.substring(2)))
          .filter(id => invoice_ids.includes(id));
        
        // Add this statement's trans_id to those invoices' linked_trans_ids!
        if (stmt.trans_id) {
          originalLinkedIds.forEach(invId => {
            if (invoiceTransIdsMap[invId]) {
              invoiceTransIdsMap[invId].add(stmt.trans_id);
            }
          });
        }
      }

      // First, handle UNLINKED statements! Remove their trans_id and subtract their amount!
      const unlinkedStatements = relevantStatements.filter(
        stmt => initialLinkedStatementIdsSet.has(stmt.id) && !selectedStatementIdsSet.has(stmt.id)
      );
      console.log(`[invoices-bulk-link] Statements to UNLINK: ${unlinkedStatements.map(s => s.id)}`);

      for (const stmt of unlinkedStatements) {
        const originalTokens = parseLinkedPurchaseTokens(originalLinkedPurchaseIdsMap[stmt.id]); // use original!
        const originalLinkedIds = originalTokens
          .filter(token => token.startsWith('IP'))
          .map(token => parseInt(token.substring(2)))
          .filter(id => invoice_ids.includes(id));
        
        // Subtract the amount (we'll recalculate after, but let's first remove trans_id!)
        // Also remove trans_id from linked_trans_ids!
        if (stmt.trans_id) {
          originalLinkedIds.forEach(invId => {
            if (invoiceTransIdsMap[invId]) {
              invoiceTransIdsMap[invId].delete(stmt.trans_id);
            }
          });
        }
      }

      // Now, process NEW statements only! Don't re-distribute existing ones!
      const newStatementsOnly = statementsToDistribute.filter(stmt => !initialLinkedStatementIdsSet.has(stmt.id));
      console.log(`[invoices-bulk-link] New statements to add: ${newStatementsOnly.map(s => s.id)}`);

      // Distribute NEW statements across invoices
      for (const stmt of newStatementsOnly) {
        let remainingToAllocate = Number(stmt.amount || 0);
        
        let targetInvoices = sortedInvoices;
        
        console.log(`[invoices-bulk-link] Statement ${stmt.id} (new=true): amount=₹${remainingToAllocate}, targetInvoices=${targetInvoices.map(i => i.id)}`);
        
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

        // Add trans_id to all target invoices' linked_trans_ids
        const transId = stmt.trans_id;
        if (transId) {
          invoice_ids.forEach(invId => {
            if (invoiceTransIdsMap[invId]) {
              invoiceTransIdsMap[invId].add(transId);
            }
          });
        }
      }

      // Now, RECALCULATE amount_paid from scratch using ALL linked statements (original - unlinked + new)!
      // Because the existing amount_paid might have been calculated differently before!
      // First, get ALL linked statements for each invoice!
      const [allStatements] = await conn.query(
        "SELECT id, trans_id, amount, linked_purchase_ids, invoice_number FROM statements"
      );

      // Build a map of invoice_id -> list of statements linked to it
      const invoiceToStatementsMap = {};
      sortedInvoices.forEach(inv => invoiceToStatementsMap[inv.id] = []);

      for (const stmt of allStatements) {
        // Check if this statement is linked to any of our invoices!
        const linkedTokens = parseLinkedPurchaseTokens(stmt.linked_purchase_ids);
        const linkedIdsFromToken = linkedTokens
          .filter(t => t.startsWith('IP'))
          .map(t => parseInt(t.substring(2)));
        
        const linkedIdsFromInvoiceNumber = [];
        if (stmt.invoice_number) {
          const invWithMatchingNumber = sortedInvoices.find(i => i.invoice_number === stmt.invoice_number);
          if (invWithMatchingNumber) {
            linkedIdsFromInvoiceNumber.push(invWithMatchingNumber.id);
          }
        }

        const allLinkedIds = [...new Set([...linkedIdsFromToken, ...linkedIdsFromInvoiceNumber])];
        
        for (const invId of allLinkedIds) {
          if (invoiceToStatementsMap[invId]) {
            invoiceToStatementsMap[invId].push(stmt);
          }
        }
      }

      // Now, recalculate amount_paid properly for each invoice!
      sortedInvoices.forEach(inv => {
        const invGrandTotal = Number(inv.grand_total || 0);
        let totalPaid = 0;
        
        // Sort statements to process in consistent order!
        const stmtList = invoiceToStatementsMap[inv.id] || [];
        stmtList.sort((a, b) => a.id - b.id);
        
        for (const stmt of stmtList) {
          if (totalPaid >= invGrandTotal) break;
          
          const stmtAmount = Math.abs(Number(stmt.amount || 0));
          const remaining = Math.max(0, invGrandTotal - totalPaid);
          const toAdd = Math.min(remaining, stmtAmount);
          
          totalPaid += toAdd;
        }
        
        invoicePaidMap[inv.id] = totalPaid;
      });

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
