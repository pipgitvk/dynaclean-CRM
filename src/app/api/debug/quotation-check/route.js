/**
 * Quick debug endpoint to check quotation payment_term_days
 * GET /api/debug/quotation-check?quote_number=QUOTE20260623003
 */

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const quoteNumber = searchParams.get("quote_number");

    if (!quoteNumber) {
      return NextResponse.json({ error: "quote_number is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    // Fetch quotation details
    const [qRows] = await conn.execute(
      `SELECT quote_number, payment_term_days, quote_date, company_name FROM quotations_records WHERE quote_number = ?`,
      [quoteNumber]
    );

    if (!Array.isArray(qRows) || qRows.length === 0) {
      return NextResponse.json({
        found: false,
        quote_number: quoteNumber,
        message: "Quotation not found",
      });
    }

    const quota = qRows[0];

    return NextResponse.json({
      found: true,
      quote_number: quota.quote_number,
      payment_term_days: quota.payment_term_days,
      quote_date: quota.quote_date,
      company_name: quota.company_name,
      isCOD: quota.payment_term_days === 9,
    });
  } catch (error) {
    console.error("Debug error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
