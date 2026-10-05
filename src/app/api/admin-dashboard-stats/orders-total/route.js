import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import dayjs from "dayjs";

/** Same pool as OrderTable stat cards: approved, not cancelled, not rejected. */
const STAT_ORDER_WHERE = `
  DATE(no.created_at) >= ?
  AND DATE(no.created_at) <= ?
  AND no.approval_status = 'approved'
  AND COALESCE(no.is_cancelled, 0) = 0
`;

export async function GET(request) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(request.url);

  try {
    const dateFrom =
      searchParams.get("dateFrom") ||
      dayjs().startOf("month").format("YYYY-MM-DD");
    const dateTo =
      searchParams.get("dateTo") ||
      dayjs().endOf("month").format("YYYY-MM-DD");

    console.log(
      `[Orders Total] Fetching for date range: ${dateFrom} to ${dateTo}`,
    );

    // Match OrderTable getTotalAmount() + getPaymentColumnAmount():
    // Total: quotation grand_total → totalamt → baseAmount + taxamt
    // Taxable: quotation subtotal → sum(quotation_items) → baseAmount → totalamt - taxamt
    const [result] = await conn.execute(
      `
      SELECT 
        COUNT(DISTINCT no.order_id) as total_orders,
        COALESCE(SUM(
          CASE 
            WHEN qr.grand_total > 0 THEN qr.grand_total
            WHEN COALESCE(no.totalamt, 0) > 0 THEN no.totalamt
            ELSE GREATEST(
              COALESCE(no.totalamt, 0),
              COALESCE(no.baseAmount, 0) + COALESCE(no.taxamt, 0)
            )
          END
        ), 0) as total_amount,
        COALESCE(SUM(CASE WHEN no.payment_status = 'paid' THEN 
          CASE 
            WHEN qr.grand_total > 0 THEN qr.grand_total
            WHEN COALESCE(no.totalamt, 0) > 0 THEN no.totalamt
            ELSE GREATEST(
              COALESCE(no.totalamt, 0),
              COALESCE(no.baseAmount, 0) + COALESCE(no.taxamt, 0)
            )
          END
          ELSE 0 END), 0) as paid_amount,
        COALESCE(SUM(CASE WHEN no.payment_status != 'paid' THEN 
          CASE 
            WHEN qr.grand_total > 0 THEN qr.grand_total
            WHEN COALESCE(no.totalamt, 0) > 0 THEN no.totalamt
            ELSE GREATEST(
              COALESCE(no.totalamt, 0),
              COALESCE(no.baseAmount, 0) + COALESCE(no.taxamt, 0)
            )
          END
          ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(
          CASE 
            WHEN qr.subtotal > 0 THEN qr.subtotal
            WHEN COALESCE(qi_sum.item_taxable, 0) > 0 THEN qi_sum.item_taxable
            WHEN no.baseAmount IS NOT NULL AND no.baseAmount != '' THEN no.baseAmount
            ELSE GREATEST(0, COALESCE(no.totalamt, 0) - COALESCE(no.taxamt, 0))
          END
        ), 0) as taxable_amount
      FROM neworder no
      LEFT JOIN quotations_records qr ON no.quote_number = qr.quote_number
      LEFT JOIN (
        SELECT
          quote_number,
          SUM(COALESCE(total_taxable_amt, taxable_price, 0)) AS item_taxable
        FROM quotation_items
        GROUP BY quote_number
      ) qi_sum ON no.quote_number = qi_sum.quote_number
      WHERE ${STAT_ORDER_WHERE}
    `,
      [dateFrom, dateTo],
    );

    const totalOrders = result[0]?.total_orders || 0;
    const totalAmount = parseFloat(result[0]?.total_amount) || 0;
    const paidAmount = parseFloat(result[0]?.paid_amount) || 0;
    const pendingAmount = parseFloat(result[0]?.pending_amount) || 0;
    const taxableAmount = parseFloat(result[0]?.taxable_amount) || 0;

    console.log(
      `[Orders Total] Results: orders=${totalOrders}, total=${totalAmount}, taxable=${taxableAmount}`,
    );

    return NextResponse.json({
      success: true,
      data: {
        total_orders: totalOrders,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        pending_amount: pendingAmount,
        taxable_amount: taxableAmount,
      },
    });
  } catch (error) {
    console.error("Error fetching orders total:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch orders total",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
