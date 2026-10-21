import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseForm";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { uploadOrderAccountFile } from "@/lib/uploadOrderAccountFile";
import {
  hasOrderInvoiceReport,
  isBeforeDispatch,
} from "@/lib/orderDocumentEditRules";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { lookupInvoiceLinkedPayment } from "@/lib/invoiceLinkedPaymentLookup";
import {
  linkedPaymentsToOrderPaymentCsv,
  mergeOrderPaymentWithLinkedCsv,
  sumPaymentAmountCsv,
} from "@/lib/orderPaymentHistory";

const MAX_FILES_PER_FIELD = 5;

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

async function saveFilesField(fileField) {
  if (!fileField) return "";
  const list = Array.isArray(fileField) ? fileField : [fileField];
  const paths = [];
  for (const item of list.slice(0, MAX_FILES_PER_FIELD)) {
    const file = getFile(item);
    if (file?.filepath) {
      paths.push(await uploadOrderAccountFile(file));
    }
  }
  return paths.filter(Boolean).join(",");
}

// POST handler
export async function POST(req) {
  try {
    const { fields, files } = await parseFormData(req, { multiples: true });

    const orderId = parseInt(fields.order_id);
    if (!orderId) throw new Error("Missing or invalid order_id");

    const baseAmount = parseFloat(fields.baseAmount);
    const taxAmt = parseFloat(fields.taxamt);
    const totalAmt = parseFloat(fields.totalamt);

    const invoiceNumber = Array.isArray(fields.invoice_number)
      ? fields.invoice_number[0]
      : fields.invoice_number;
    const dueDate = Array.isArray(fields.duedate)
      ? fields.duedate[0]
      : fields.duedate; // this is invoice date from UI
    const remark = Array.isArray(fields.remark)
      ? fields.remark[0]
      : fields.remark || "";

    // Validate mandatory remark field
    if (!remark || remark.trim() === "") {
      return NextResponse.json(
        { error: "Remark is required" },
        { status: 400 }
      );
    }

    // New payment fields
    const paymentId = Array.isArray(fields.payment_id)
      ? fields.payment_id[0]
      : fields.payment_id || null;
    const paymentDate = Array.isArray(fields.payment_date)
      ? fields.payment_date[0]
      : fields.payment_date || null;
    const paymentAmount =
      fields.payment_amount !== undefined
        ? parseFloat(
            Array.isArray(fields.payment_amount)
              ? fields.payment_amount[0]
              : fields.payment_amount
          )
        : null;

    const reportPath = await saveFilesField(files.report_file);
    if (!reportPath) {
      return NextResponse.json(
        { error: "Invoice PDF is required" },
        { status: 400 },
      );
    }

    // PDF → local, images → Cloudinary — up to 5 per field, comma-separated paths/URLs
    const ewaybillPath = await saveFilesField(files.ewaybill_file);
    const einvoicePath = await saveFilesField(files.einvoice_file);
    const challanPath = await saveFilesField(files.deliverchallan);

    // DB connection
    const conn = await getDbConnection();
    const payload = await getSessionPayload();
    const accountBy = payload?.username || payload?.name || null;

    // Find quote_number and order state
    const [orderRows] = await conn.execute(
      `SELECT quote_number, duedate, dispatch_status,
              ewaybill_file, einvoice_file, report_file, deliverchallan,
              payment_id, payment_date, payment_amount, payment_status,
              amount_received, payment_received_date, linked_payments_json
       FROM neworder WHERE order_id = ?`,
      [orderId]
    );
    const existingOrder =
      Array.isArray(orderRows) && orderRows.length ? orderRows[0] : {};

    if (
      !isBeforeDispatch(existingOrder) &&
      hasOrderInvoiceReport(existingOrder)
    ) {
      return NextResponse.json(
        { error: "Invoice and tax documents cannot be edited after dispatch." },
        { status: 403 },
      );
    }

    const quoteNumber = existingOrder.quote_number;

    // Get payment_term_days from quotation (if available)
    let paymentTermDays = 0;
    if (quoteNumber) {
      const [qRows] = await conn.execute(
        `SELECT payment_term_days FROM quotations_records WHERE quote_number = ?`,
        [quoteNumber]
      );
      if (Array.isArray(qRows) && qRows.length) {
        paymentTermDays = Number(qRows[0]?.payment_term_days) || 0;
      }
    }

    await ensureOrderLinkedPaymentColumns(conn);

    let paymentIdSave = paymentId;
    let paymentDateSave = paymentDate;
    let paymentAmountSave =
      fields.payment_amount !== undefined && fields.payment_amount !== ""
        ? String(
            Array.isArray(fields.payment_amount)
              ? fields.payment_amount[0]
              : fields.payment_amount,
          )
        : null;

    let amountReceived = null;
    let paymentReceivedDate = null;
    let linkedPaymentsJson = null;
    if (invoiceNumber && String(invoiceNumber).trim()) {
      const linked = await lookupInvoiceLinkedPayment(
        conn,
        String(invoiceNumber).trim(),
      );
      if (linked?.found) {
        const amt = Number(linked.payment_amount);
        if (Number.isFinite(amt) && amt > 0) amountReceived = amt;
        paymentReceivedDate = linked.payment_date || null;
        if (Array.isArray(linked.payments) && linked.payments.length) {
          linkedPaymentsJson = JSON.stringify(linked.payments);
        }
        const fromPayments = linkedPaymentsToOrderPaymentCsv(
          linked.payments || [],
        );
        let linkedCsv = null;
        if (linked.payment_amount_csv) {
          linkedCsv = {
            payment_id: linked.payment_id || fromPayments.payment_id,
            payment_date: linked.payment_date || fromPayments.payment_date,
            payment_amount: linked.payment_amount_csv,
          };
        } else if (fromPayments.payment_amount) {
          linkedCsv = fromPayments;
        } else if (amountReceived != null) {
          linkedCsv = {
            payment_id: linked.payment_id || null,
            payment_date: linked.payment_date || null,
            payment_amount: String(amountReceived),
          };
        }

        if (linkedCsv?.payment_amount) {
          const merged = mergeOrderPaymentWithLinkedCsv(existingOrder, linkedCsv);
          paymentAmountSave = merged.payment_amount;
          paymentIdSave = merged.payment_id || paymentIdSave;
          paymentDateSave = merged.payment_date || paymentDateSave;
        }
      }
    }

    if (!paymentAmountSave && existingOrder.payment_amount) {
      paymentAmountSave = String(existingOrder.payment_amount);
      paymentIdSave = paymentIdSave ?? existingOrder.payment_id ?? null;
      paymentDateSave = paymentDateSave ?? existingOrder.payment_date ?? null;
    }
    if (amountReceived == null && existingOrder.amount_received != null) {
      amountReceived = existingOrder.amount_received;
      paymentReceivedDate =
        paymentReceivedDate ?? existingOrder.payment_received_date ?? null;
      linkedPaymentsJson =
        linkedPaymentsJson ?? existingOrder.linked_payments_json ?? null;
    }

    // Compute payment_status server-side (supports comma-separated payment_amount)
    let paymentStatus = "pending";
    const paid = sumPaymentAmountCsv(paymentAmountSave);
    const total = Number(totalAmt) || 0;

    let isOverdue = false;

    if (paid >= total && total > 0) paymentStatus = "paid";
    else if (paid > 0 && paid < total) paymentStatus = "partially paid";
    else if (paid === 0 && isOverdue) paymentStatus = "over due";
    else if (paid === 0 && existingOrder.payment_status) {
      paymentStatus = existingOrder.payment_status;
    } else paymentStatus = "pending";

    // Save to DB (merge file fields when not re-uploaded)
    const mergedReportPath = reportPath || existingOrder.report_file || "";
    const mergedEwaybillPath =
      ewaybillPath || existingOrder.ewaybill_file || "";
    const mergedEinvoicePath =
      einvoicePath || existingOrder.einvoice_file || "";
    const mergedChallanPath =
      challanPath || existingOrder.deliverchallan || "";

    await conn.execute(
      `UPDATE neworder SET 
        baseAmount = ?, 
        ewaybill_file = ?, 
        report_file = ?, 
        einvoice_file = ?, 
        deliverchallan = ?, 
        invoice_number = ?, 
        invoice_date = ?, 
        taxamt = ?, 
        totalamt = ?, 
        payment_id = ?,
        payment_date = ?,
        payment_amount = ?,
        amount_received = ?,
        payment_received_date = ?,
        linked_payments_json = ?,
        payment_status = ?,
        account_status = ?, 
        account_by = ?,
        account_remark = ? 
      WHERE order_id = ?`,
      [
        baseAmount,
        mergedEwaybillPath,
        mergedReportPath,
        mergedEinvoicePath,
        mergedChallanPath,
        invoiceNumber,
        dueDate,
        taxAmt,
        totalAmt,
        paymentIdSave,
        paymentDateSave,
        paymentAmountSave,
        amountReceived,
        paymentReceivedDate,
        linkedPaymentsJson,
        paymentStatus,
        1, // account_status
        accountBy,
        remark,
        orderId,
      ]
    );

    // await conn.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Upload Error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
