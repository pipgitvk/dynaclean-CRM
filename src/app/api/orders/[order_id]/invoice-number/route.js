import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureOrderLinkedPaymentColumns } from "@/lib/ensureOrderLinkedPaymentColumns";
import { syncOrderLinkedPaymentFromInvoice } from "@/lib/syncOrderLinkedPaymentFromInvoice";

const ALLOWED_ROLES = new Set([
  "ACCOUNTANT",
  "ADMIN",
  "SUPERADMIN",
  "TEAM LEADER",
  "DIRECTOR",
]);

function canEditOrderInvoiceNumber(userRole) {
  const r = String(userRole || "").trim().toUpperCase();
  return ALLOWED_ROLES.has(r);
}

export async function PATCH(req, { params }) {
  let conn;
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { order_id: orderId } = await params;
    if (!orderId) {
      return NextResponse.json({ error: "Missing order id" }, { status: 400 });
    }

    const body = await req.json();
    const invoiceNumber = String(body.invoice_number ?? "").trim();

    conn = await getDbConnection();

    const [roleRows] = await conn.execute(
      "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
      [payload.username],
    );
    const userRole = roleRows?.[0]?.userRole || "";
    if (!canEditOrderInvoiceNumber(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await ensureOrderLinkedPaymentColumns(conn);

    const [existing] = await conn.execute(
      "SELECT order_id FROM neworder WHERE order_id = ? LIMIT 1",
      [orderId],
    );
    if (!existing?.length) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    await conn.execute(
      `UPDATE neworder SET invoice_number = ? WHERE order_id = ?`,
      [invoiceNumber || null, orderId],
    );

    const [rows] = await conn.execute(
      `SELECT order_id, quote_number, invoice_number, totalamt, amount_received,
              payment_received_date, linked_payments_json, payment_id, payment_date,
              payment_amount, payment_status
       FROM neworder WHERE order_id = ? LIMIT 1`,
      [orderId],
    );

    const synced = await syncOrderLinkedPaymentFromInvoice(conn, rows[0]);

    return NextResponse.json({
      success: true,
      invoice_number: synced.invoice_number || null,
      amount_received: synced.amount_received ?? null,
      payment_received_date: synced.payment_received_date ?? null,
      linked_payments_json: synced.linked_payments_json ?? null,
      payment_id: synced.payment_id ?? null,
      payment_date: synced.payment_date ?? null,
      payment_amount: synced.payment_amount ?? null,
      payment_status: synced.payment_status ?? null,
    });
  } catch (e) {
    console.error("PATCH order invoice_number:", e);
    return NextResponse.json(
      { error: e.message || "Failed to update invoice number" },
      { status: 500 },
    );
  } finally {
    try {
      conn?.release?.();
    } catch (_) {}
  }
}
