import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  loadInvoiceWithItemsForPdf,
  sendInvoicePaymentNoticeEmail,
} from "@/lib/invoiceCustomerEmailNotice";

export async function GET(_req, context) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = Number(id);
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [[inv]] = await conn.execute(
      `SELECT * FROM invoices WHERE id = ? LIMIT 1`,
      [invoiceId],
    );

    if (!inv) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const invoice = { ...inv };
    const noCustomerId =
      invoice.customer_id == null ||
      String(invoice.customer_id).trim() === "";
    const qRef =
      invoice.quotation_id != null
        ? String(invoice.quotation_id).trim()
        : "";
    if (noCustomerId && qRef !== "") {
      try {
        const [[qr]] = await conn.execute(
          `SELECT customer_id AS cid FROM quotations_records
           WHERE TRIM(CAST(\`S.No.\` AS CHAR)) = TRIM(CAST(? AS CHAR))
           LIMIT 1`,
          [qRef],
        );
        if (qr?.cid != null && String(qr.cid).trim() !== "") {
          invoice.customer_id = qr.cid;
        }
      } catch (lookupErr) {
        console.warn(
          "Invoice GET: quotation customer_id lookup skipped:",
          lookupErr?.message || lookupErr,
        );
      }
    }

    const [items] = await conn.execute(
      `SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id ASC`,
      [invoiceId],
    );

    return NextResponse.json({
      success: true,
      invoice,
      items: items || [],
    });
  } catch (err) {
    console.error("Invoice GET error:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch invoice",
        detail: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req, context) {
  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const invoiceId = Number(id);
    if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
      return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
    }

    const body = await req.json();

    const {
      quotation_id = null,
      invoice_number,
      invoice_date,
      order_date = null,
      due_date = null,
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
      created_at = null,
      customer_id: bodyCustomerId,
      linked_trans_ids: bodyLinkedTransIds,
      send_customer_payment_notice = false,
    } = body;

    if (!invoice_number || !customer_name || !billing_address) {
      return NextResponse.json(
        { error: "invoice_number, customer_name, and billing_address are required" },
        { status: 400 },
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one line item is required" },
        { status: 400 },
      );
    }

    const pool = await getDbConnection();

    let linkedTransIdsSql;
    if (Array.isArray(bodyLinkedTransIds)) {
      linkedTransIdsSql =
        bodyLinkedTransIds.length > 0
          ? JSON.stringify(bodyLinkedTransIds)
          : null;
    } else {
      const [[lr]] = await pool.execute(
        `SELECT linked_trans_ids AS v FROM invoices WHERE id = ? LIMIT 1`,
        [invoiceId],
      );
      linkedTransIdsSql = lr?.v ?? null;
    }

    let customerIdVal = bodyCustomerId;
    if (customerIdVal === undefined) {
      const [[cr]] = await pool.execute(
        `SELECT customer_id AS v FROM invoices WHERE id = ? LIMIT 1`,
        [invoiceId],
      );
      customerIdVal = cr?.v ?? null;
    }

    conn = await pool.getConnection();

    try {
      await conn.execute("SELECT customer_id FROM invoices LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoices ADD COLUMN customer_id VARCHAR(64) NULL");
      } catch (__) {}
    }
    try {
      await conn.execute("SELECT linked_trans_ids FROM invoices LIMIT 1");
    } catch (_) {
      try {
        await conn.execute("ALTER TABLE invoices ADD COLUMN linked_trans_ids TEXT NULL");
      } catch (__) {}
    }

    const [[existing]] = await conn.execute(
      `SELECT id FROM invoices WHERE id = ? LIMIT 1`,
      [invoiceId],
    );
    if (!existing) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const [[dup]] = await conn.execute(
      `SELECT id FROM invoices WHERE invoice_number = ? AND id != ? LIMIT 1`,
      [invoice_number, invoiceId],
    );
    if (dup) {
      return NextResponse.json(
        { error: "Another invoice already uses this invoice number" },
        { status: 409 },
      );
    }

    const serverInvoiceDate = invoice_date
      ? String(invoice_date).slice(0, 10)
      : null;
    if (!serverInvoiceDate) {
      return NextResponse.json(
        { error: "invoice_date is required" },
        { status: 400 },
      );
    }

    const serverDueDate =
      due_date != null && String(due_date).trim() !== ""
        ? String(due_date).slice(0, 10)
        : null;

    const serverOrderDate =
      order_date != null && String(order_date).trim() !== ""
        ? String(order_date).slice(0, 10)
        : null;

    await conn.beginTransaction();

    const toMysqlDatetime = (v) => {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return null;
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    const createdAtSql =
      created_at != null && String(created_at).trim() !== ""
        ? toMysqlDatetime(created_at)
        : null;

    if (createdAtSql) {
      await conn.execute(
        `UPDATE invoices SET
          quotation_id = ?, invoice_number = ?, invoice_date = ?, order_date = ?, due_date = ?,
          customer_name = ?, customer_email = ?, customer_phone = ?,
          billing_address = ?, shipping_address = ?, Consignee = ?, Consignee_Contact = ?,
          gst_number = ?, state = ?, state_code = ?,
          subtotal = ?, cgst = ?, sgst = ?, igst = ?, total_tax = ?, round_off = ?, grand_total = ?,
          amount_paid = ?, balance_amount = ?, payment_status = ?, notes = ?, terms_conditions = ?,
          buyers_order_no = ?, eway_bill_no = ?, delivery_challan_no = ?,
          customer_id = ?, linked_trans_ids = ?,
          created_at = ?
        WHERE id = ?`,
        [
          quotation_id,
          invoice_number,
          serverInvoiceDate,
          serverOrderDate,
          serverDueDate,
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
        customerIdVal ?? null,
        linkedTransIdsSql,
          createdAtSql,
          invoiceId,
        ],
      );
    } else {
      await conn.execute(
        `UPDATE invoices SET
          quotation_id = ?, invoice_number = ?, invoice_date = ?, order_date = ?, due_date = ?,
          customer_name = ?, customer_email = ?, customer_phone = ?,
          billing_address = ?, shipping_address = ?, Consignee = ?, Consignee_Contact = ?,
          gst_number = ?, state = ?, state_code = ?,
          subtotal = ?, cgst = ?, sgst = ?, igst = ?, total_tax = ?, round_off = ?, grand_total = ?,
          amount_paid = ?, balance_amount = ?, payment_status = ?, notes = ?, terms_conditions = ?,
          buyers_order_no = ?, eway_bill_no = ?, delivery_challan_no = ?,
          customer_id = ?, linked_trans_ids = ?
        WHERE id = ?`,
        [
          quotation_id,
          invoice_number,
          serverInvoiceDate,
          serverOrderDate,
          serverDueDate,
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
        customerIdVal ?? null,
        linkedTransIdsSql,
          invoiceId,
        ],
      );
    }

    await conn.execute(`DELETE FROM invoice_items WHERE invoice_id = ?`, [
      invoiceId,
    ]);

    for (const item of items) {
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

    /** @type {{ sent?: boolean, skipped?: boolean, reason?: string, error?: string } | null} */
    let customerEmailNotice = null;
    const shouldNotifyCustomer =
      send_customer_payment_notice === true ||
      send_customer_payment_notice === "true";
    if (shouldNotifyCustomer) {
      try {
        const emailTrim =
          customer_email != null ? String(customer_email).trim() : "";
        if (!emailTrim) {
          customerEmailNotice = {
            sent: false,
            skipped: true,
            reason: "missing_customer_email",
          };
        } else {
          const invFull = await loadInvoiceWithItemsForPdf(pool, invoiceId);
          if (invFull) {
            customerEmailNotice =
              await sendInvoicePaymentNoticeEmail(invFull);
          } else {
            customerEmailNotice = {
              sent: false,
              error: "invoice_reload_failed",
            };
          }
        }
      } catch (emailErr) {
        console.error("Invoice PATCH customer email:", emailErr);
        customerEmailNotice = {
          sent: false,
          error: emailErr?.message || String(emailErr),
        };
      }
    }

    return NextResponse.json({ success: true, invoiceId, customerEmailNotice });
  } catch (e) {
    console.error("Invoice PATCH error:", e);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackError) {
        console.error("Rollback error:", rollbackError);
      }
    }
    return NextResponse.json(
      { success: false, error: e.message || String(e) },
      { status: 500 },
    );
  } finally {
    try {
      conn?.release?.();
    } catch {}
  }
}
