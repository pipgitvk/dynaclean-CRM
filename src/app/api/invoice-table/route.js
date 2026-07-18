import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
// import { cookies } from "next/headers";

/** Parse linked_trans_ids JSON or plain string → array of strings */
function parseTransIds(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Parse linked_purchase_ids (JSON, comma-separated, or single token) → array of strings */
function parseLinkedPurchaseIds(raw) {
  if (!raw) return [];
  let arr = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      arr = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      arr = raw.split(',').map(s => s.trim()).filter(Boolean);
    }
  }
  if (!arr) return [];
  const keys = [];
  for (const v of arr) {
    if (v == null) continue;
    const s = String(v).trim().toUpperCase();
    if (!s) continue;
    if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
      keys.push(s);
    } else if (/^\d+$/.test(s)) {
      keys.push(`IP${s}`);
    }
  }
  return keys;
}

export async function GET(req) {
  try {
    // const cookieStore = cookies();
    // const token = cookieStore.get("token")?.value;
    // if (!token) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);

    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 20;
    const offset = (page - 1) * limit;

    const sortBy = searchParams.get("sort") || "created_at";
    const sortOrder = searchParams.get("order") === "asc" ? "ASC" : "DESC";

    const search = searchParams.get("search");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");

    const conn = await getDbConnection();

    // 🔎 Filters
    let where = "WHERE 1=1";
    const values = [];

    if (search) {
      where += " AND (invoice_number LIKE ? OR customer_name LIKE ?)";
      values.push(`%${search}%`, `%${search}%`);
    }

    if (fromDate) {
      where += " AND DATE(created_at) >= ?";
      values.push(fromDate);
    }

    if (toDate) {
      where += " AND DATE(created_at) <= ?";
      values.push(toDate);
    }

    // 📊 Count
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS total FROM invoices ${where}`,
      values,
    );

    const total = countRow.total;
    const totalPages = Math.ceil(total / limit);

    // Check if employee_name column exists in invoices table
    try {
      await conn.execute("SELECT employee_name FROM invoices LIMIT 1");
      console.log("employee_name column exists in invoices table");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoices ADD COLUMN employee_name VARCHAR(255) NULL DEFAULT NULL AFTER gst_number");
        console.log("Added employee_name column to invoices table");
      } catch (__) {
        console.error("Failed to add employee_name column to invoices table");
      }
    }

    // Data buyer_name
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        invoice_number,
        customer_name AS buyer_name,
        gst_number,
        employee_name,
        parent_id,
        COALESCE(order_date, invoice_date) AS order_date,
        (cgst + sgst + igst) AS tax_amount,
        grand_total,
        amount_paid,
        COALESCE(balance_amount, grand_total - COALESCE(amount_paid, 0)) AS balance_amount,
        created_at
      FROM invoices
      ${where}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset],
    );

    // Check if item_code column exists in invoice_items table
    try {
      await conn.execute("SELECT item_code FROM invoice_items LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoice_items ADD COLUMN item_code VARCHAR(100) NULL");
      } catch (__) {}
    }

    // First, fetch ALL statements that are linked to ANY of the invoices (for allocation)
    const allInvoiceIds = rows.map(inv => inv.id);
    const [allLinkedStatements] = await conn.execute(
      "SELECT id, trans_id, date, description, amount, invoice_status, linked_purchase_ids, invoice_number FROM statements"
    );
    
    // Build invoice map
    const invoiceMap = {};
    const invoiceNumberToIdMap = {};
    rows.forEach(inv => {
      invoiceMap[inv.id] = inv;
      if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
    });
    
    // Also get parent/child invoices for allocation completeness
    const allRelatedInvoiceIds = new Set(allInvoiceIds);
    for (const inv of rows) {
      if (inv.parent_id) allRelatedInvoiceIds.add(inv.parent_id);
      const [children] = await conn.execute("SELECT id FROM invoices WHERE parent_id = ?", [inv.id]);
      children.forEach(c => allRelatedInvoiceIds.add(c.id));
    }
    let allRelatedInvoices = [];
    const relatedInvoiceIdsArr = [...allRelatedInvoiceIds];
    if (relatedInvoiceIdsArr.length > 0) {
      const placeholders = relatedInvoiceIdsArr.map(() => '?').join(',');
      const [result] = await conn.execute(
        `SELECT id, grand_total, invoice_number FROM invoices WHERE id IN (${placeholders})`,
        relatedInvoiceIdsArr
      );
      allRelatedInvoices = result;
    }
    allRelatedInvoices.forEach(inv => {
      if (!invoiceMap[inv.id]) invoiceMap[inv.id] = inv;
      if (inv.invoice_number) invoiceNumberToIdMap[inv.invoice_number] = inv.id;
    });
    
    // Build transToInvoiceIdsMap for all statements (PRESERVING ORDER from linked_purchase_ids)
    const transToInvoiceIdsMap = {};
    for (const stmt of allLinkedStatements) {
      const linkedIds = [];
      const seenIds = new Set();
      // Add from linked_purchase_ids (IN ORDER)
      const tokens = parseLinkedPurchaseIds(stmt.linked_purchase_ids);
      for (const token of tokens) {
        if (token.startsWith("IP")) {
          const invId = parseInt(token.replace("IP", ""));
          if (invoiceMap[invId] && !seenIds.has(invId)) {
            linkedIds.push(invId);
            seenIds.add(invId);
          }
        }
      }
      // Add from invoice_number (at the end, if not already added)
      if (stmt.invoice_number && invoiceNumberToIdMap[stmt.invoice_number]) {
        const invId = invoiceNumberToIdMap[stmt.invoice_number];
        if (!seenIds.has(invId)) {
          linkedIds.push(invId);
          seenIds.add(invId);
        }
      }
      transToInvoiceIdsMap[stmt.trans_id] = linkedIds;
    }
    
    // Calculate allocation map
    const allocationMap = {};
    const invoiceRemainingMap = {};
    for (const invId in invoiceMap) {
      invoiceRemainingMap[invId] = Number(invoiceMap[invId].grand_total) || 0;
    }
    
    // Process all statements for allocation
    for (const stmt of allLinkedStatements) {
      const linkedInvIds = transToInvoiceIdsMap[stmt.trans_id] || [];
      if (linkedInvIds.length === 0) continue;
      
      let remainingToAllocate = Math.abs(Number(stmt.amount) || 0);
      const invoicePaidForStmt = {};
      for (const invId of linkedInvIds) {
        if (remainingToAllocate <= 0) break;
        const invRemaining = invoiceRemainingMap[invId] || 0;
        if (invRemaining <= 0) continue;
        const toAllocate = Math.min(invRemaining, remainingToAllocate);
        if (toAllocate > 0) {
          invoicePaidForStmt[invId] = toAllocate;
          invoiceRemainingMap[invId] -= toAllocate;
          remainingToAllocate -= toAllocate;
        }
      }
      // Save to allocation map
      for (const invId of linkedInvIds) {
        const key = `${invId}-${stmt.trans_id}`;
        allocationMap[key] = invoicePaidForStmt[invId] || 0;
      }
    }
    
    // Fetch items and linked statements for each invoice
  const invoicesWithItems = await Promise.all(
    rows.map(async (invoice) => {
      const [items] = await conn.execute(
        "SELECT item_code as product_code, item_name, quantity, rate as price_per_unit, image_url as imageUrl, hsn_code, taxable_value, cgst_amount, sgst_amount, igst_amount FROM invoice_items WHERE invoice_id = ?",
        [invoice.id]
      );
      
      // Get all related invoice IDs and invoice numbers: this invoice, parent, and children
      let relatedInvoices = [{id: invoice.id, number: invoice.invoice_number}];
      if (invoice.parent_id) {
        // If this invoice has a parent, get parent and all siblings
        const [parent] = await conn.execute(
          "SELECT id, invoice_number FROM invoices WHERE id = ?",
          [invoice.parent_id]
        );
        if (parent.length > 0) {
          relatedInvoices.push({id: parent[0].id, number: parent[0].invoice_number});
        }
        // Get all siblings (invoices with same parent)
        const [siblings] = await conn.execute(
          "SELECT id, invoice_number FROM invoices WHERE parent_id = ?",
          [invoice.parent_id]
        );
        siblings.forEach(s => relatedInvoices.push({id: s.id, number: s.invoice_number}));
      } else {
        // If this invoice is a parent, get all its children
        const [children] = await conn.execute(
          "SELECT id, invoice_number FROM invoices WHERE parent_id = ?",
          [invoice.id]
        );
        children.forEach(c => relatedInvoices.push({id: c.id, number: c.invoice_number}));
      }
      // Remove duplicates
      const uniqueRelatedInvoices = [];
      const seenInvoiceIds = new Set();
      for (const inv of relatedInvoices) {
        if (!seenInvoiceIds.has(inv.id)) {
          seenInvoiceIds.add(inv.id);
          uniqueRelatedInvoices.push(inv);
        }
      }
      
      // Fetch linked statements for all related invoices (by ID or number)
      let linkedStatements = [];
      for (const inv of uniqueRelatedInvoices) {
        const [stmts] = await conn.execute(
          "SELECT id, trans_id, date, description, amount, invoice_status, linked_purchase_ids FROM statements WHERE linked_purchase_ids LIKE ? OR invoice_number = ?",
          [`%IP${inv.id}%`, inv.number]
        );
        linkedStatements.push(...stmts);
      }
      
      // Remove duplicate statements (in case a statement is linked to multiple related invoices)
      const uniqueLinkedStatements = [];
      const seenStmtIds = new Set();
      for (const stmt of linkedStatements) {
        if (!seenStmtIds.has(stmt.id)) {
          seenStmtIds.add(stmt.id);
          uniqueLinkedStatements.push(stmt);
        }
      }
      linkedStatements = uniqueLinkedStatements;
      
      // Calculate total linked amount using allocation map
      const totalLinkedAmount = linkedStatements.reduce(
        (sum, stmt) => {
          const key = `${invoice.id}-${stmt.trans_id}`;
          return sum + (allocationMap[key] || 0);
        },
        0
      );
      const newBalanceAmount = Math.max(0, Number(invoice.grand_total) - totalLinkedAmount);
      
      // Log for debugging
      console.log(`Invoice ${invoice.id} (${invoice.invoice_number}) related invoices:`, uniqueRelatedInvoices);
      console.log(`Linked statements:`, linkedStatements.map(s => ({id: s.id, trans_id: s.trans_id, invoice_number: s.invoice_number})));
      
      return {
        ...invoice,
        items: items || [],
        linkedStatements: linkedStatements || [],
        balance_amount: newBalanceAmount
      };
    })
  );

    return NextResponse.json({
      success: true,
      data: invoicesWithItems,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    console.error("Invoice list error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch invoices",
        detail: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  let conn;
  try {
    const token = req.cookies.get("token")?.value;
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    console.log("Invoice creation request body:", { quotation_id: body.quotation_id, customer_name: body.customer_name });

    const {
      quotation_id = null,
      invoice_date,
      order_date = null,
      due_date,
      customer_name,
      customer_email = null,
      customer_phone = null,
      billing_address,
      shipping_address = null,
      Consignee = null,
      Consignee_Contact = null,
      gst_number = null,
      state = null,
      state_code = null,
      items,
      subtotal,
      cgst,
      sgst,
      igst,
      total_tax,
      round_off,
      grand_total,
      amount_paid = 0,
      balance_amount,
      payment_status = "UNPAID",
      notes = null,
      terms_conditions = null,
      buyers_order_no = null,
      eway_bill_no = null,
      delivery_challan_no = null,
      linked_trans_ids = null,
      customer_id: bodyCustomerId,
    } = body;

    const customerIdSql =
      bodyCustomerId != null && String(bodyCustomerId).trim() !== ""
        ? String(bodyCustomerId).trim()
        : null;

    const linkedTransIdsJson =
      linked_trans_ids && linked_trans_ids.length > 0
        ? JSON.stringify(linked_trans_ids)
        : null;

    const pool = await getDbConnection();
    conn = await pool.getConnection();

    // Fetch employee name from quotation if quotation_id is provided
    let employeeName = payload?.username || null;
    console.log("Initial employeeName from session:", employeeName);
    console.log("quotation_id:", quotation_id);
    if (quotation_id) {
      try {
        // First try to find by quote_number
        let [quoteResult] = await conn.execute(
          "SELECT emp_name FROM quotations_records WHERE quote_number = ?",
          [quotation_id]
        );
        console.log("Quotation query result (by quote_number):", quoteResult);

        // If not found by quote_number, try by primary key S.No.
        if (quoteResult.length === 0) {
          [quoteResult] = await conn.execute(
            "SELECT emp_name FROM quotations_records WHERE `S.No.` = ?",
            [quotation_id]
          );
          console.log("Quotation query result (by S.No.):", quoteResult);
        }

        if (quoteResult.length > 0 && quoteResult[0].emp_name) {
          employeeName = quoteResult[0].emp_name;
          console.log("Employee name from quotation (emp_name):", employeeName);
        } else {
          console.log("Quotation found but no emp_name, using session username:", employeeName);
        }
      } catch (err) {
        console.error("Failed to fetch employee name from quotation:", err);
        // Fall back to session username
      }
    } else {
      console.log("No quotation_id provided, using session username:", employeeName);
    }

    await conn.beginTransaction();

    // Generate invoice number from DB sequence (no hardcoded segment)
    const now = new Date();
    // Indian FY: Apr–Mar → e.g. DYN/2026-27/001 (not calendar month like 2026-04)
    const getDefaultPrefix = (date) => {
      const month = date.getMonth() + 1; // 1–12
      const year = date.getFullYear();
      const startYear = month >= 4 ? year : year - 1;
      const endYear2Digits = String((startYear + 1) % 100).padStart(2, "0");
      return `DYN/${startYear}-${endYear2Digits}/`;
    };
    const serverInvoiceDate = invoice_date || now.toISOString().split("T")[0];
    const serverOrderDate =
      order_date != null && String(order_date).trim() !== ""
        ? String(order_date).slice(0, 10)
        : null;
    const dateForPrefix = invoice_date
      ? new Date(`${String(invoice_date).slice(0, 10)}T12:00:00`)
      : now;
    const invoicePrefix = getDefaultPrefix(dateForPrefix);

    let attempt = 0;
    let finalInvoiceNumber = "";
    let invoiceId = null;

    while (attempt < 5) {
      const [existing] = await conn.execute(
        `SELECT invoice_number FROM invoices 
         WHERE invoice_number LIKE ? 
         ORDER BY invoice_number DESC 
         LIMIT 1`,
        [`${invoicePrefix}%`],
      );

      let increment = 1;
      if (existing.length > 0) {
        const lastInvoice = existing[0].invoice_number || "";
        const lastIncrement = parseInt(
          lastInvoice.replace(invoicePrefix, ""),
          10,
        );
        if (!Number.isNaN(lastIncrement)) increment = lastIncrement + 1;
      }

      finalInvoiceNumber = `${invoicePrefix}${increment.toString().padStart(3, "0")}`;

      try {
        // Insert the invoice header
        // Ensure linked_trans_ids column exists
        try {
          await conn.execute("SELECT linked_trans_ids FROM invoices LIMIT 1");
        } catch (_) {
          try {
            await conn.execute(
              "ALTER TABLE invoices ADD COLUMN linked_trans_ids TEXT NULL"
            );
          } catch (__) {}
        }
        try {
          await conn.execute("SELECT customer_id FROM invoices LIMIT 1");
        } catch (_) {
          try {
            await conn.execute(
              "ALTER TABLE invoices ADD COLUMN customer_id VARCHAR(64) NULL",
            );
          } catch (__) {}
        }

        // Check if employee_name column exists
        let employeeNameColumnExists = false;
        try {
          await conn.execute("SELECT employee_name FROM invoices LIMIT 1");
          employeeNameColumnExists = true;
          console.log("employee_name column exists in invoices table (POST)");
        } catch (_) {
          try {
            await conn.execute("ALTER TABLE invoices ADD COLUMN employee_name VARCHAR(255) NULL DEFAULT NULL AFTER gst_number");
            employeeNameColumnExists = true;
            console.log("Added employee_name column to invoices table (POST)");
          } catch (__) {
            console.error("Failed to add employee_name column to invoices table (POST)");
          }
        }

        // Conditionally build INSERT statement based on whether employee_name column exists
        let insertQuery, insertValues;
        if (employeeNameColumnExists) {
          insertQuery = `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, employee_name, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          insertValues = [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            shipping_address,
            Consignee,
            Consignee_Contact,
            gst_number,
            employeeName,
            state,
            state_code,
            subtotal,
            cgst,
            sgst,
            igst,
            total_tax,
            round_off || 0,
            grand_total,
            amount_paid,
            balance_amount,
            payment_status,
            notes,
            terms_conditions,
            buyers_order_no,
            eway_bill_no,
            delivery_challan_no,
            customerIdSql,
            linkedTransIdsJson,
          ];
        } else {
          insertQuery = `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
          insertValues = [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            shipping_address,
            Consignee,
            Consignee_Contact,
            gst_number,
            state,
            state_code,
            subtotal,
            cgst,
            sgst,
            igst,
            total_tax,
            round_off || 0,
            grand_total,
            amount_paid,
            balance_amount,
            payment_status,
            notes,
            terms_conditions,
            buyers_order_no,
            eway_bill_no,
            delivery_challan_no,
            customerIdSql,
            linkedTransIdsJson,
          ];
        }

        const [result] = await conn.execute(insertQuery, insertValues);

        console.log("Inserted invoice with employee_name:", { invoice_number: finalInvoiceNumber, employee_name: employeeName, insertId: result.insertId });

        invoiceId = result.insertId;
        // Success, break retry loop
        break;
      } catch (err) {
        // If unique constraint exists and we hit duplicate, retry with next seq
        if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
          attempt += 1;
          continue;
        }
        throw err;
      }
    }

    if (!finalInvoiceNumber || !invoiceId) {
      throw new Error("Failed to generate unique invoice number");
    }

    // Insert invoice_items for each item
    for (let item of items) {
      const item_name = item.item_name || null;
      const item_code = item.item_code || null;
      const description = item.description || null;
      const hsn_code = item.hsn_code || null;
      const quantity = item.quantity || 0;
      const rate = item.rate || 0;
      const discount_percent = item.discount_percent || 0;
      const discount_amount = item.discount_amount || 0;
      const taxable_value = item.taxable_value || 0;
      const cgst_percent = item.cgst_percent || 0;
      const sgst_percent = item.sgst_percent || 0;
      const igst_percent = item.igst_percent || 0;
      const cgst_amount = item.cgst_amount || 0;
      const sgst_amount = item.sgst_amount || 0;
      const igst_amount = item.igst_amount || 0;
      const total_amount = item.total_amount || 0;

      await conn.execute(
        `INSERT INTO invoice_items 
         (invoice_id, item_code, item_name, description, hsn_code, quantity, rate, discount_percent, 
          discount_amount, taxable_value, cgst_percent, sgst_percent, igst_percent, 
          cgst_amount, sgst_amount, igst_amount, total_amount, image_url, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          invoiceId,
          item_code,
          item_name,
          description,
          hsn_code,
          quantity,
          rate,
          discount_percent,
          discount_amount,
          taxable_value,
          cgst_percent,
          sgst_percent,
          igst_percent,
          cgst_amount,
          sgst_amount,
          igst_amount,
          total_amount,
          item.imageUrl || item.image_url || null,
        ],
      );
    }

    await conn.commit();
    return NextResponse.json({
      success: true,
      invoiceNumber: finalInvoiceNumber,
      invoiceId: invoiceId,
    });
  } catch (e) {
    console.error("Invoice submission error:", e);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback Error:", rollbackError);
      }
    }
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  } finally {
    try {
      conn?.release?.();
    } catch {}
  }
}
