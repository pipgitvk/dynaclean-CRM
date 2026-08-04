import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { order_id, quote_number, items } = body;

    if (!order_id || !items || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "order_id and items are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // Verify the order exists and is dispatched
    const [orderRows] = await conn.execute(
      "SELECT order_id, dispatch_status, is_returned, invoice_number, invoice_date FROM neworder WHERE order_id = ?",
      [order_id]
    );

    if (!orderRows.length) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];

    if (Number(order.dispatch_status) !== 1) {
      return NextResponse.json(
        { success: false, error: "Return can only be initiated for dispatched orders" },
        { status: 400 }
      );
    }

    // ── Prevent duplicate return initiations ────────────────────────────────
    // If order is already marked as returned (1), partially returned (2), or 
    // return initiated (3), don't allow another return initiation
    const currentReturnStatus = Number(order.is_returned || 0);
    if (currentReturnStatus === 1 || currentReturnStatus === 2 || currentReturnStatus === 3) {
      return NextResponse.json(
        { success: false, error: `Return already initiated or completed for this order (status: ${currentReturnStatus})` },
        { status: 400 }
      );
    }

    // Fetch quotation record for customer info
    let quoteRecord = null;
    if (quote_number) {
      const [quoteRows] = await conn.execute(
        `SELECT company_name, company_address, gstin, state, emp_name, ship_to,
                gst, subtotal, grand_total, cgst_rate, sgst_rate, igst_rate
         FROM quotations_records WHERE quote_number = ?`,
        [quote_number]
      );
      quoteRecord = quoteRows[0] || null;
    }

    // Fetch full item details from quotation_items for tax calculation
    const itemIds = items.map((i) => i.id);
    let fullItems = [];
    if (itemIds.length > 0) {
      const placeholders = itemIds.map(() => "?").join(",");
      const [itemRows] = await conn.execute(
        `SELECT id, item_name, item_code, hsn_sac, specification, quantity, unit,
                price_per_unit, taxable_price, total_taxable_amt,
                gst, total_price, cgsttax, cgsttxamt, sgsttax, sgstxamt, igsttax, igsttamt
         FROM quotation_items WHERE id IN (${placeholders})`,
        itemIds
      );
      fullItems = itemRows;
    }

    // Fetch all items to determine full vs partial
    const [allItems] = await conn.execute(
      "SELECT id FROM quotation_items WHERE quote_number = ?",
      [quote_number]
    );

    const allItemIds = new Set(allItems.map((i) => i.id));
    const returnItemIds = new Set(items.map((i) => i.id));
    const isFullReturn =
      allItemIds.size > 0 && [...allItemIds].every((id) => returnItemIds.has(id));
    const returnType = isFullReturn ? "full" : "partial";

    // Calculate totals
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const enrichedItems = fullItems.map((fi) => {
      taxableAmount += Number(fi.total_taxable_amt || fi.taxable_price || 0);
      cgstAmount += Number(fi.cgsttxamt || 0);
      sgstAmount += Number(fi.sgstxamt || 0);
      igstAmount += Number(fi.igsttamt || 0);
      return {
        id: fi.id,
        item_name: fi.item_name,
        item_code: fi.item_code,
        hsn_sac: fi.hsn_sac,
        specification: fi.specification,
        quantity: fi.quantity,
        unit: fi.unit,
        price_per_unit: Number(fi.price_per_unit || 0),
        taxable_price: Number(fi.total_taxable_amt || fi.taxable_price || 0),
        gst_rate: Number(fi.gst || 0),
        cgst_rate: Number(fi.cgsttax || 0),
        cgst_amount: Number(fi.cgsttxamt || 0),
        sgst_rate: Number(fi.sgsttax || 0),
        sgst_amount: Number(fi.sgstxamt || 0),
        igst_rate: Number(fi.igsttax || 0),
        igst_amount: Number(fi.igsttamt || 0),
        total_price: Number(fi.total_price || 0),
      };
    });

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const grandTotal = taxableAmount + totalTax;

    const quotationNo = quote_number || `QT-${order_id}`;
    const invoiceNo = order.invoice_number || `INV-${order_id}`;

    // ── Insert into return_products ──────────────────────────────────────────
    const [insertResult] = await conn.execute(
      `INSERT INTO return_products
         (quotation_no, invoice_no, model_no, serial_no, pricing_total,
          return_type, return_status, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NOW())`,
      [
        quotationNo,
        invoiceNo,
        fullItems.map((fi) => fi.item_code || fi.item_name).join(", "),
        "",
        grandTotal,
        returnType,
        payload.username,
      ]
    );

    const returnId = insertResult.insertId;

    // ── Insert individual items into return_items ────────────────────────────
    for (const it of enrichedItems) {
      await conn.execute(
        `INSERT INTO return_items
           (return_id, quotation_no, item_code, item_name, quantity, price_per_unit, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          quotationNo,
          it.item_code || "",
          it.item_name || "",
          it.quantity || 1,
          it.price_per_unit || 0,
          it.total_price || 0,
        ]
      );
    }

    // ── NOTE: is_returned status will be updated to 3 when credit note is saved ──
    // Do NOT update order status here. Wait until user clicks "Download & Save"
    // This ensures order only shows "Return Initiated" after credit note is confirmed.

    // ── Return draft credit note data (NOT saved to credit_notes table yet) ──
    // The credit note will only be saved to DB when user clicks "Download & Save"
    const draftCreditNote = {
      order_id: String(order_id),
      quote_number: quotationNo,
      invoice_no: invoiceNo,
      return_id: returnId,
      company_name: quoteRecord?.company_name || null,
      company_address: quoteRecord?.company_address || null,
      customer_gstin: quoteRecord?.gstin || null,
      customer_state: quoteRecord?.state || null,
      credit_note_date: new Date().toISOString().split("T")[0],
      invoice_date: order.invoice_date
        ? new Date(order.invoice_date).toISOString().split("T")[0]
        : null,
      items: enrichedItems,
      taxable_amount: taxableAmount,
      cgst_amount: cgstAmount,
      sgst_amount: sgstAmount,
      igst_amount: igstAmount,
      total_tax: totalTax,
      grand_total: grandTotal,
      return_type: returnType,
      created_by: payload.username,
    };

    return NextResponse.json({
      success: true,
      draft: draftCreditNote,
      return_id: returnId,
      return_type: returnType,
      grand_total: grandTotal,
      message: `Return initiated successfully.`,
    });
  } catch (err) {
    console.error("POST /api/orders/return-initiate error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
