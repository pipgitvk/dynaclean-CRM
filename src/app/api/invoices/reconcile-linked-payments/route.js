import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  reconcileAllInvoicePaymentLinks,
  reconcileInvoicePaymentLink,
} from "@/lib/reconcileInvoicePaymentLinks";

const ALLOWED = new Set([
  "ADMIN",
  "SUPERADMIN",
  "ACCOUNTANT",
  "TEAM LEADER",
  "DIRECTOR",
]);

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const [roleRows] = await conn.execute(
      "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
      [payload.username],
    );
    const role = String(roleRows?.[0]?.userRole || "").trim().toUpperCase();
    if (!ALLOWED.has(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const invoiceNumber = String(body.invoice_number || "").trim();
    const reconcileAll = body.all === true || body.all === "true";

    if (reconcileAll) {
      const summary = await reconcileAllInvoicePaymentLinks(conn, {
        limit: body.limit,
      });
      return NextResponse.json({
        success: true,
        message: `Reconciled ${summary.updated} of ${summary.total} invoice(s).`,
        ...summary,
      });
    }

    if (!invoiceNumber) {
      return NextResponse.json(
        { error: "invoice_number is required (or pass all: true)" },
        { status: 400 },
      );
    }

    const result = await reconcileInvoicePaymentLink(conn, invoiceNumber);
    if (!result.ok && result.reason === "invoice_not_found") {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: result.updated
        ? `Invoice ${invoiceNumber}: ₹${result.amount_paid} linked, status ${result.payment_status}`
        : result.message || "No changes needed",
      result,
    });
  } catch (e) {
    console.error("POST reconcile-linked-payments:", e);
    return NextResponse.json(
      { error: e?.message || "Reconcile failed" },
      { status: 500 },
    );
  }
}
