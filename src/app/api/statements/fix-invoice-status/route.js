import { getDbConnection } from "@/lib/db";
import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

/**
 * POST /api/statements/fix-invoice-status
 *
 * One-time fix: finds all statements where linked_purchase_ids contains
 * at least one IP-token (invoice link) but invoice_status is NULL/empty/'Unsettled',
 * and sets invoice_status = 'Settled' for them.
 *
 * Also handles the reverse: if linked_purchase_ids has NO tokens at all
 * AND client_expense_id is NULL AND invoice_number is NULL/empty,
 * ensures invoice_status = 'Unsettled' (keeps things clean).
 */
export async function POST(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      // Fetch all statements that might need fixing:
      // 1. Those with IP tokens but wrong status
      // 2. Those with invoice_number set but status not Settled
      const [rows] = await conn.execute(
        `SELECT id, linked_purchase_ids, invoice_status, client_expense_id, invoice_number, dd_id, failed_transaction_id, cancelled_transaction_id
         FROM statements
         WHERE (invoice_status IS NULL OR invoice_status = '' OR invoice_status = 'Unsettled')
         ORDER BY id ASC`
      );

      let fixedCount = 0;
      const fixedIds = [];

      for (const row of rows) {
        let shouldBeSettled = false;

        // Check invoice_number column — if set, it's linked to an invoice
        if (row.invoice_number != null && String(row.invoice_number).trim() !== "") {
          shouldBeSettled = true;
        }

        // Check linked_purchase_ids for IP tokens
        if (!shouldBeSettled && row.linked_purchase_ids != null && String(row.linked_purchase_ids).trim() !== "") {
          let arr = [];
          try {
            const parsed = JSON.parse(String(row.linked_purchase_ids));
            if (Array.isArray(parsed)) arr = parsed;
          } catch {
            arr = String(row.linked_purchase_ids).split(",").map(s => s.trim()).filter(Boolean);
          }
          for (const v of arr) {
            const s = String(v ?? "").trim().toUpperCase();
            // IP = Invoice, PP/PS/SP = Purchase/Spare
            if (/^(IP|PP|PS|SP)\d+$/.test(s)) {
              shouldBeSettled = true;
              break;
            }
          }
        }

        if (shouldBeSettled) {
          await conn.execute(
            "UPDATE statements SET invoice_status = 'Settled' WHERE id = ?",
            [row.id]
          );
          fixedIds.push(row.id);
          fixedCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Fixed ${fixedCount} statement(s).`,
        fixedIds,
      });
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error("[fix-invoice-status] error:", err?.message || err);
    return NextResponse.json({ error: "Server error: " + (err?.message || err) }, { status: 500 });
  }
}
