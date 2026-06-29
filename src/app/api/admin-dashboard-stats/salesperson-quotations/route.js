import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(request.url);

  try {
    const salesperson = searchParams.get("salesperson");
    const timeRange = searchParams.get("timeRange") || "thisMonth";

    if (!salesperson) {
      return NextResponse.json({ success: false, error: "Salesperson required" }, { status: 400 });
    }

    // Calculate date range - same as TopAchievers (full month)
    const today = new Date();
    let startDate, endDate;

    switch (timeRange) {
      case "today":
        startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case "thisWeek":
        const first = new Date(today);
        first.setDate(today.getDate() - today.getDay());
        startDate = first;
        endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        break;
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default: // thisMonth
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    }

    const pad = (n) => String(n).padStart(2, "0");
    const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const dateFrom = fmt(startDate);
    const dateTo = fmt(endDate);

    // EXACT same JOIN structure as TopAchievers API
    // quotations_records → neworder → quotation_items
    const [quotations] = await conn.execute(`
      SELECT 
        no.order_id,
        no.client_name,
        no.created_at,
        no.payment_status,
        qr.company_name,
        qr.quote_number,
        COALESCE(SUM(COALESCE(qi.total_taxable_amt, qi.taxable_price, qi.price_per_unit * qi.quantity, 0)), 0) as taxable_amount
      FROM quotations_records qr
      LEFT JOIN neworder no 
        ON no.quote_number = qr.quote_number
        AND no.approval_status = 'approved'
        AND DATE(no.created_at) >= ?
        AND DATE(no.created_at) <= ?
      LEFT JOIN quotation_items qi 
        ON qi.quote_number = no.quote_number
      WHERE CAST(qr.emp_name AS CHAR) = CAST(? AS CHAR) COLLATE utf8mb4_unicode_ci
        AND no.order_id IS NOT NULL
      GROUP BY no.order_id, no.client_name, no.created_at, no.payment_status, qr.company_name, qr.quote_number
      ORDER BY no.created_at DESC
    `, [dateFrom, dateTo, salesperson]);

    const totalAmount = quotations.reduce((sum, q) => sum + parseFloat(q.taxable_amount || 0), 0);

    console.log(`[Salesperson Quotations] ${salesperson}: ${quotations.length} orders, total=${totalAmount}`);

    return NextResponse.json({
      success: true,
      salesperson,
      total_amount: totalAmount,
      data: quotations
    });

  } catch (error) {
    console.error("Error fetching salesperson quotations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch quotations", details: error.message },
      { status: 500 }
    );
  }
}
