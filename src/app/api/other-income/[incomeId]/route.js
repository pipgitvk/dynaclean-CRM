import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "public", "income_attachments");

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
  }
}

// Save file to disk
async function saveFile(file, namePrefix) {
  if (!file || typeof file === "string" || !file.size) return null;

  const fileName = `${namePrefix}-${Date.now()}${path.extname(file.name)}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(filePath, buffer);
  console.log(`✅ File saved: ${filePath}`);
  return `/income_attachments/${fileName}`;
}

// GET - Fetch single other income entry
export async function GET(req, { params }) {
  let conn = null;
  try {
    const { incomeId } = params;
    console.log(`[other-income-api] GET /api/other-income/${incomeId}`);

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    conn = await getDbConnection();

    const query = `
      SELECT * FROM other_income
      WHERE id = ? AND username = ?
    `;

    const [rows] = await conn.execute(query, [incomeId, payload.username]);

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("[other-income-api] ERROR:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("[other-income-api] Error closing connection:", e);
      }
    }
  }
}

// PATCH - Update other income entry
export async function PATCH(req, { params }) {
  let conn = null;
  try {
    const { incomeId } = params;
    console.log(`[other-income-api] PATCH /api/other-income/${incomeId}`);

    const payload = await getSessionPayload();
    if (!payload) {
      console.error("[other-income-api] ERROR: Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureUploadDir();

    const formData = await req.formData();
    const fields = Object.fromEntries(formData.entries());

    conn = await getDbConnection();

    // Get existing record to know which files to update
    const [existing] = await conn.execute(
      `SELECT * FROM other_income WHERE id = ? AND username = ?`,
      [incomeId, payload.username]
    );

    if (!existing || existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const currentRecord = existing[0];

    // Save file uploads (use new files if provided, otherwise keep existing)
    const receiptAttachment =
      (await saveFile(formData.get("receipt_attachment"), "receipt")) ||
      currentRecord.receipt_attachment_path;
    const proofAttachment =
      (await saveFile(formData.get("proof_attachment"), "proof")) ||
      currentRecord.proof_attachment_path;
    const invoiceAttachment =
      (await saveFile(formData.get("invoice_attachment"), "invoice")) ||
      currentRecord.invoice_attachment_path;
    const supportingDocument =
      (await saveFile(formData.get("supporting_document"), "document")) ||
      currentRecord.supporting_document_path;

    console.log(`[other-income-api] Files to update - receipt: ${receiptAttachment}, proof: ${proofAttachment}`);

    const query = `
      UPDATE other_income SET
        income_name = ?,
        income_source = ?,
        income_category = ?,
        amount = ?,
        income_date = ?,
        transaction_date = ?,
        description = ?,
        gst_applicable = ?,
        gst_rate = ?,
        gst_amount = ?,
        tds_deducted = ?,
        tds_amount = ?,
        received_from = ?,
        receipt_mode = ?,
        bank_cash_account = ?,
        reference_number = ?,
        invoice_bill_number = ?,
        receipt_attachment_path = ?,
        proof_attachment_path = ?,
        invoice_attachment_path = ?,
        supporting_document_path = ?,
        remarks = ?
      WHERE id = ? AND username = ?
    `;

    const values = [
      fields.income_name || currentRecord.income_name,
      fields.income_source || currentRecord.income_source,
      fields.income_category || currentRecord.income_category,
      fields.amount || currentRecord.amount,
      fields.income_date || currentRecord.income_date,
      fields.transaction_date || currentRecord.transaction_date,
      fields.description || currentRecord.description,
      fields.gst_applicable || currentRecord.gst_applicable,
      fields.gst_rate || currentRecord.gst_rate,
      fields.gst_amount || currentRecord.gst_amount,
      fields.tds_deducted || currentRecord.tds_deducted,
      fields.tds_amount || currentRecord.tds_amount,
      fields.received_from || currentRecord.received_from,
      fields.receipt_mode || currentRecord.receipt_mode,
      fields.bank_cash_account || currentRecord.bank_cash_account,
      fields.reference_number || currentRecord.reference_number,
      fields.invoice_bill_number || currentRecord.invoice_bill_number,
      receiptAttachment,
      proofAttachment,
      invoiceAttachment,
      supportingDocument,
      fields.remarks || currentRecord.remarks,
      incomeId,
      payload.username,
    ];

    await conn.execute(query, values);
    console.log("[other-income-api] SUCCESS - Other income entry updated");

    return NextResponse.json({ success: true, message: "Other income entry updated successfully" });
  } catch (err) {
    console.error("[other-income-api] ERROR:", err?.message || err);
    return NextResponse.json({ error: "Server error", details: err.message }, { status: 500 });
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("[other-income-api] Error closing connection:", e);
      }
    }
  }
}

// DELETE - Delete other income entry
export async function DELETE(req, { params }) {
  let conn = null;
  try {
    const { incomeId } = params;
    console.log(`[other-income-api] DELETE /api/other-income/${incomeId}`);

    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    conn = await getDbConnection();

    const query = `
      DELETE FROM other_income
      WHERE id = ? AND username = ? AND approval_status = 'Pending'
    `;

    const result = await conn.execute(query, [incomeId, payload.username]);

    if (result.affectedRows === 0) {
      return NextResponse.json(
        { error: "Cannot delete approved/rejected entries" },
        { status: 400 }
      );
    }

    console.log("[other-income-api] SUCCESS - Other income entry deleted");
    return NextResponse.json({ success: true, message: "Other income entry deleted successfully" });
  } catch (err) {
    console.error("[other-income-api] ERROR:", err?.message || err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  } finally {
    if (conn) {
      try {
        await conn.end();
      } catch (e) {
        console.error("[other-income-api] Error closing connection:", e);
      }
    }
  }
}
