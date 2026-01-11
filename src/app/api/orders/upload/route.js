import { NextResponse } from "next/server";
import { parseFormData } from "@/lib/parseFormData";
import fs from "fs";
import path from "path";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";

// Ensure the target folder exists
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Save file to public/Order/accounts/
async function saveFileLocally(file) {
  if (!file || !file.filepath) throw new Error("Missing file");

  const uploadDir = path.join(process.cwd(), "public", "Order", "accounts");
  ensureDir(uploadDir);

  const ext = path.extname(file.originalFilename || "") || ".bin";
  const uniqueName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
  const destPath = path.join(uploadDir, uniqueName);

  await fs.promises.copyFile(file.filepath, destPath);

  // Return relative URL (for database usage)
  return `/Order/accounts/${uniqueName}`;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Normalize file input
const getFile = (f) => (Array.isArray(f) ? f[0] : f);

// POST handler
export async function POST(req) {
  try {
    const { fields, files } = await parseFormData(req);

    const orderId = parseInt(fields.order_id);
    if (!orderId) throw new Error("Missing or invalid order_id");

    const baseAmount = parseFloat(fields.baseAmount);
    const taxAmt = parseFloat(fields.taxamt);
    const totalAmt = parseFloat(fields.totalamt);

    const invoiceNumber = Array.isArray(fields.invoice_number) ? fields.invoice_number[0] : fields.invoice_number;
    const dueDate = Array.isArray(fields.duedate) ? fields.duedate[0] : fields.duedate; // this is invoice date from UI
    const remark = Array.isArray(fields.remark) ? fields.remark[0] : fields.remark || "";

    // Validate mandatory remark field
    if (!remark || remark.trim() === '') {
      return NextResponse.json({ error: "Remark is required" }, { status: 400 });
    }

    // New payment fields
    const paymentId = Array.isArray(fields.payment_id) ? fields.payment_id[0] : fields.payment_id || null;
    const paymentDate = Array.isArray(fields.payment_date) ? fields.payment_date[0] : fields.payment_date || null;
    const paymentAmount = fields.payment_amount !== undefined ? parseFloat(Array.isArray(fields.payment_amount) ? fields.payment_amount[0] : fields.payment_amount) : null;

    // Save files locally (if present)
    const ewaybillPath = files.ewaybill_file ? await saveFileLocally(getFile(files.ewaybill_file)) : "";
    const einvoicePath = files.einvoice_file ? await saveFileLocally(getFile(files.einvoice_file)) : "";
    const reportPath = files.report_file ? await saveFileLocally(getFile(files.report_file)) : "";
    const challanPath = files.deliverchallan ? await saveFileLocally(getFile(files.deliverchallan)) : "";

    // DB connection
    const conn = await getDbConnection();
    const payload = await getSessionPayload();
    const accountBy = payload?.username || payload?.name || null;

    // Find quote_number and, if needed, existing invoice date for this order
    const [orderRows] = await conn.execute(
      `SELECT quote_number, duedate FROM neworder WHERE order_id = ?`,
      [orderId]
    );
    const existingOrder = Array.isArray(orderRows) && orderRows.length ? orderRows[0] : {};
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

    // Compute payment_status server-side
    let paymentStatus = "pending";
    const paid = Number(paymentAmount) || 0;
    const total = Number(totalAmt) || 0;

    // Determine overdue: invoice date + paymentTermDays < today
    let isOverdue = false;
    // const invoiceDateIso = dueDate || existingOrder.duedate; // field named duedate but UI uses as invoice date
    // if (invoiceDateIso && paymentTermDays > 0) {
    //   const inv = new Date(invoiceDateIso);
    //   const due = new Date(inv);
    //   due.setDate(due.getDate() + paymentTermDays);
    //   const today = new Date();
    //   isOverdue = today.setHours(0,0,0,0) > due.setHours(0,0,0,0);
    // }

    if (paid >= total && total > 0) paymentStatus = "paid";
    else if (paid > 0 && paid < total) paymentStatus = "partially paid";
    else if (paid === 0 && isOverdue) paymentStatus = "over due";
    else paymentStatus = "pending";

    // Save to DB (include baseAmount and new payment fields)
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
        payment_status = ?,
        account_status = ?, 
        account_by = ?,
        account_remark = ? 
      WHERE order_id = ?`,
      [
        baseAmount,
        ewaybillPath,
        reportPath,
        einvoicePath,
        challanPath,
        invoiceNumber,
        dueDate,
        taxAmt,
        totalAmt,
        paymentId,
        paymentDate,
        isNaN(paid) ? null : paid,
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
    return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
  }
}
