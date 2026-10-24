import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import {
  loadInvoiceWithItemsForPdf,
  sendInvoicePaymentNoticeEmail,
} from "@/lib/invoiceCustomerEmailNotice";
import { isPerformaInvoice } from "@/lib/ledgerInvoiceFilters";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const invoiceId = Number(id);
  if (!Number.isFinite(invoiceId) || invoiceId <= 0) {
    return NextResponse.json({ error: "Invalid invoice id" }, { status: 400 });
  }

  try {
    const pool = await getDbConnection();
    let invFull = await loadInvoiceWithItemsForPdf(pool, invoiceId);
    if (!invFull) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const overrideEmail = String(body.customer_email || "").trim();
    if (overrideEmail) {
      invFull = { ...invFull, customer_email: overrideEmail };
    }
    if (isPerformaInvoice(invFull)) {
      return NextResponse.json({
        success: false,
        customerEmailNotice: {
          sent: false,
          skipped: true,
          reason: "performa_invoice_no_email",
        },
      });
    }

    const customerEmailNotice = await sendInvoicePaymentNoticeEmail(invFull);
    return NextResponse.json({
      success: customerEmailNotice.sent === true,
      customerEmailNotice,
    });
  } catch (err) {
    console.error("[send-customer-email]", err?.message);
    return NextResponse.json(
      {
        success: false,
        error: err?.message || "Failed to send email",
      },
      { status: 500 },
    );
  }
}
