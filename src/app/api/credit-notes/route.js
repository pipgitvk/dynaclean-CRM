import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canListAllCreditNotesRole } from "@/lib/roleKeyUtils";
import {
  initiatedStatusForReturnType,
  IS_RETURNED,
} from "@/lib/orderReturnStatus";

export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const role = payload.role ?? payload.userRole ?? "";
    if (!canListAllCreditNotesRole(role)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const conn = await getDbConnection();
    try {
      await conn.execute(
        `ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0`,
      );
    } catch (_) {}

    const [rows] = await conn.execute(
      `SELECT id, credit_note_number, order_id, quote_number, invoice_no,
              company_name, credit_note_date, invoice_date, grand_total,
              return_type, is_saved, saved_at, created_by, created_at
       FROM credit_notes
       WHERE is_saved = 1
       ORDER BY COALESCE(saved_at, created_at) DESC, id DESC`,
    );

    return NextResponse.json({ success: true, data: rows });
  } catch (err) {
    console.error("GET /api/credit-notes error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function applyReturnInitiatedOrderStatus(conn, order_id, return_type) {
  const orderIdKey = String(order_id ?? "").trim();
  if (!orderIdKey) return;
  const [checkOrder] = await conn.execute(
    "SELECT is_returned FROM neworder WHERE order_id = ?",
    [orderIdKey],
  );
  if (!checkOrder.length) {
    console.warn(
      `[credit-notes] order not found for is_returned update: ${orderIdKey}`,
    );
    return;
  }
  const currentReturnStatus = Number(checkOrder[0].is_returned || 0);
  if (
    currentReturnStatus === IS_RETURNED.FULLY_RETURNED ||
    currentReturnStatus === IS_RETURNED.PARTIALLY_RETURNED
  ) {
    return;
  }
  const nextStatus = initiatedStatusForReturnType(return_type || "partial");
  const [updateResult] = await conn.execute(
    "UPDATE neworder SET is_returned = ? WHERE order_id = ?",
    [nextStatus, orderIdKey],
  );
  console.log(
    `[credit-notes] is_returned=${nextStatus} for order_id=${orderIdKey}, affectedRows=${updateResult.affectedRows}`,
  );
}

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      order_id, quote_number, invoice_no, return_id,
      company_name, company_address, customer_gstin, customer_state,
      credit_note_date, invoice_date,
      items, taxable_amount, cgst_amount, sgst_amount, igst_amount,
      total_tax, grand_total, return_type, created_by,
    } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: "order_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Ensure table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS credit_notes (
        id INT PRIMARY KEY AUTO_INCREMENT,
        credit_note_number VARCHAR(100) NOT NULL UNIQUE,
        order_id VARCHAR(100) NOT NULL,
        quote_number VARCHAR(255),
        invoice_no VARCHAR(255),
        return_id INT NULL,
        company_name VARCHAR(255),
        company_address TEXT,
        customer_gstin VARCHAR(100),
        customer_state VARCHAR(100),
        credit_note_date DATE NOT NULL,
        invoice_date DATE,
        payment_date DATE,
        items JSON,
        taxable_amount DECIMAL(20,2) DEFAULT 0,
        cgst_amount DECIMAL(20,2) DEFAULT 0,
        sgst_amount DECIMAL(20,2) DEFAULT 0,
        igst_amount DECIMAL(20,2) DEFAULT 0,
        total_tax DECIMAL(20,2) DEFAULT 0,
        grand_total DECIMAL(20,2) DEFAULT 0,
        return_type ENUM('partial','full') DEFAULT 'partial',
        is_saved TINYINT(1) NOT NULL DEFAULT 0,
        saved_at DATETIME NULL DEFAULT NULL,
        created_by VARCHAR(100),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_id (order_id),
        INDEX idx_quote_number (quote_number),
        INDEX idx_credit_note_number (credit_note_number),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    try {
      await conn.execute(
        `ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS is_saved TINYINT(1) NOT NULL DEFAULT 0`
      );
      await conn.execute(
        `ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS saved_at DATETIME NULL DEFAULT NULL`
      );
    } catch (_) {}

    // Prevent duplicate saves for same return_id
    if (return_id) {
      const [existing] = await conn.execute(
        "SELECT id, credit_note_number FROM credit_notes WHERE return_id = ? AND is_saved = 1",
        [return_id]
      );
      if (existing.length > 0) {
        await applyReturnInitiatedOrderStatus(conn, order_id, return_type);
        return NextResponse.json({
          success: true,
          credit_note_id: existing[0].id,
          credit_note_number: existing[0].credit_note_number,
          already_saved: true,
          message: "Credit note already saved.",
        });
      }
    }

    // Generate sequential number: DYN-CN001, DYN-CN002 ...
    const [cnCountRows] = await conn.execute(
      "SELECT COUNT(*) as total FROM credit_notes"
    );
    const nextNum = Number(cnCountRows[0]?.total || 0) + 1;
    const creditNoteNumber = `DYN-CN${String(nextNum).padStart(3, "0")}`;

    const [result] = await conn.execute(
      `INSERT INTO credit_notes
         (credit_note_number, order_id, quote_number, invoice_no, return_id,
          company_name, company_address, customer_gstin, customer_state,
          credit_note_date, invoice_date,
          items, taxable_amount, cgst_amount, sgst_amount, igst_amount,
          total_tax, grand_total, return_type,
          is_saved, saved_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), ?)`,
      [
        creditNoteNumber,
        String(order_id),
        quote_number || null,
        invoice_no || null,
        return_id || null,
        company_name || null,
        company_address || null,
        customer_gstin || null,
        customer_state || null,
        credit_note_date || new Date().toISOString().split("T")[0],
        invoice_date || null,
        JSON.stringify(items || []),
        taxable_amount || 0,
        cgst_amount || 0,
        sgst_amount || 0,
        igst_amount || 0,
        total_tax || 0,
        grand_total || 0,
        return_type || "partial",
        created_by || payload.username,
      ]
    );

    await applyReturnInitiatedOrderStatus(conn, order_id, return_type);

    return NextResponse.json({
      success: true,
      credit_note_id: result.insertId,
      credit_note_number: creditNoteNumber,
      message: `Credit note ${creditNoteNumber} saved successfully.`,
    });
  } catch (err) {
    console.error("POST /api/credit-notes error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
