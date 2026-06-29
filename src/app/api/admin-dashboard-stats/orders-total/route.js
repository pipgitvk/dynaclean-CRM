import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import dayjs from "dayjs";

export async function GET(request) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(request.url);

  try {
    // Default to current month (same as OrderTable default dateFrom/dateTo)
    const dateFrom = searchParams.get("dateFrom") || dayjs().startOf('month').format('YYYY-MM-DD');
    const dateTo = searchParams.get("dateTo") || dayjs().endOf('month').format('YYYY-MM-DD');

    console.log(`[Orders Total] Fetching for date range: ${dateFrom} to ${dateTo}`);

    // Match OrderTable getTotalAmount() + orderTaxableTotal() logic:
    // Priority 1: quotation grand_total, Priority 2: totalamt
    // Taxable = sum of quotation_items total_taxable_amt (approved orders only)
    // Exclude rejected orders (OrderTable hides them by default via showRejected=false)
    const [result] = await conn.execute(`
      SELECT 
        COUNT(DISTINCT no.order_id) as total_orders,
        COALESCE(SUM(
          CASE 
            WHEN qr.grand_total > 0 THEN qr.grand_total
            ELSE COALESCE(no.totalamt, 0)
          END
        ), 0) as total_amount,
        COALESCE(SUM(CASE WHEN no.payment_status = 'paid' THEN 
          CASE WHEN qr.grand_total > 0 THEN qr.grand_total ELSE COALESCE(no.totalamt, 0) END
          ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN no.payment_status != 'paid' THEN 
          CASE WHEN qr.grand_total > 0 THEN qr.grand_total ELSE COALESCE(no.totalamt, 0) END
          ELSE 0 END), 0) as pending_amount,
        COALESCE((
          SELECT SUM(COALESCE(qi2.total_taxable_amt, qi2.taxable_price, 0))
          FROM neworder no2
          LEFT JOIN quotation_items qi2 ON no2.quote_number = qi2.quote_number
          WHERE DATE(no2.created_at) >= ? AND DATE(no2.created_at) <= ?
            AND no2.approval_status = 'approved'
        ), 0) as taxable_amount
      FROM neworder no
      LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
      WHERE DATE(no.created_at) >= ? 
        AND DATE(no.created_at) <= ?
        AND (no.approval_status != 'rejected' OR no.approval_status IS NULL)
    `, [dateFrom, dateTo, dateFrom, dateTo]);

    const totalOrders = result[0]?.total_orders || 0;
    const totalAmount = parseFloat(result[0]?.total_amount) || 0;
    const paidAmount = parseFloat(result[0]?.paid_amount) || 0;
    const pendingAmount = parseFloat(result[0]?.pending_amount) || 0;
    const taxableAmount = parseFloat(result[0]?.taxable_amount) || 0;

    console.log(`[Orders Total] Results: orders=${totalOrders}, total=${totalAmount}, taxable=${taxableAmount}`);

    return NextResponse.json({
      success: true,
      data: {
        total_orders: totalOrders,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        pending_amount: pendingAmount,
        taxable_amount: taxableAmount
      }
    });

  } catch (error) {
    console.error("Error fetching orders total:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch orders total", details: error.message },
      { status: 500 }
    );
  }
}
