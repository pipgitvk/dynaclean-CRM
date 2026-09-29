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

// POST - Create new other income entry
export async function POST(req) {
  let conn = null;
  try {
    console.log("[other-income-api] POST /api/other-income - new income submission");
    
    const payload = await getSessionPayload();
    if (!payload) {
      console.error("[other-income-api] ERROR: Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    console.log(`[other-income-api] user=${username}`);

    await ensureUploadDir();

    const formData = await req.formData();
    const fields = Object.fromEntries(formData.entries());

    // Save all file uploads
    const receiptAttachment = await saveFile(formData.get("receipt_attachment"), "receipt");
    const proofAttachment = await saveFile(formData.get("proof_attachment"), "proof");
    const invoiceAttachment = await saveFile(formData.get("invoice_attachment"), "invoice");
    const supportingDocument = await saveFile(formData.get("supporting_document"), "document");

    console.log(`[other-income-api] Files saved - receipt: ${receiptAttachment}, proof: ${proofAttachment}, invoice: ${invoiceAttachment}, document: ${supportingDocument}`);

    conn = await getDbConnection();

    const query = `
      INSERT INTO other_income (
        income_name,
        income_source,
        income_category,
        amount,
        income_date,
        transaction_date,
        description,
        gst_applicable,
        gst_rate,
        gst_amount,
        tds_deducted,
        tds_amount,
        received_from,
        receipt_mode,
        bank_cash_account,
        reference_number,
        invoice_bill_number,
        receipt_attachment_path,
        proof_attachment_path,
        invoice_attachment_path,
        supporting_document_path,
        remarks,
        username,
        approval_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      fields.income_name || null,
      fields.income_source || null,
      fields.income_category || null,
      fields.amount || 0,
      fields.income_date || null,
      fields.transaction_date || null,
      fields.description || null,
      fields.gst_applicable || null,
      fields.gst_rate || null,
      fields.gst_amount || 0,
      fields.tds_deducted || null,
      fields.tds_amount || 0,
      fields.received_from || null,
      fields.receipt_mode || null,
      fields.bank_cash_account || null,
      fields.reference_number || null,
      fields.invoice_bill_number || null,
      receiptAttachment,
      proofAttachment,
      invoiceAttachment,
      supportingDocument,
      fields.remarks || null,
      username,
      "Pending",
    ];

    await conn.execute(query, values);
    console.log("[other-income-api] SUCCESS - Other income entry created");

    return NextResponse.json({ success: true, message: "Other income entry created successfully" });
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

// GET - Fetch all other income entries for the logged-in user
export async function GET(req) {
  let conn = null;
  try {
    console.log("[other-income-api] GET /api/other-income");
    
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const username = payload.username;
    conn = await getDbConnection();

    const query = `
      SELECT 
        id,
        income_name,
        income_source,
        income_category,
        amount,
        income_date,
        transaction_date,
        gst_applicable,
        gst_rate,
        gst_amount,
        tds_deducted,
        tds_amount,
        receipt_mode,
        approval_status,
        receipt_attachment_path,
        proof_attachment_path,
        invoice_attachment_path,
        supporting_document_path,
        remarks,
        created_at
      FROM other_income
      WHERE username = ?
      ORDER BY income_date DESC
    `;

    const [rows] = await conn.execute(query, [username]);
    console.log(`[other-income-api] Fetched ${rows?.length || 0} entries`);

    return NextResponse.json({ success: true, data: rows });
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
