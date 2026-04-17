import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
// import { cookies } from "next/headers";

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

    // Data buyer_name
    const [rows] = await conn.execute(
      `
      SELECT
        id,
        invoice_number,
        customer_name AS buyer_name,
        COALESCE(order_date, invoice_date) AS order_date,
        (cgst + sgst + igst) AS tax_amount,
        grand_total,
        created_at
      FROM invoices
      ${where}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
      `,
      [...values, limit, offset],
    );

    return NextResponse.json({
      success: true,
      data: rows,
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

        const [result] = await conn.execute(
          `INSERT INTO invoices 
           (quotation_id, invoice_number, invoice_date, order_date, due_date, customer_name, customer_email, 
            customer_phone, billing_address, shipping_address, Consignee, Consignee_Contact, gst_number, state, state_code, 
            subtotal, cgst, sgst, igst, total_tax, round_off, grand_total, amount_paid, balance_amount, 
            payment_status, notes, terms_conditions, buyers_order_no, eway_bill_no, delivery_challan_no,
            customer_id, linked_trans_ids, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            quotation_id,
            finalInvoiceNumber,
            serverInvoiceDate,
            serverOrderDate,
            due_date,
            customer_name,
            customer_email,
            customer_phone,
            billing_address,
            // billing_state,
            // billing_country,
            shipping_address,
            // shipping_state,
            // shipping_country,
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
          ],
        );

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
         (invoice_id, item_name, description, hsn_code, quantity, rate, discount_percent, 
          discount_amount, taxable_value, cgst_percent, sgst_percent, igst_percent, 
          cgst_amount, sgst_amount, igst_amount, total_amount, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          invoiceId,
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
