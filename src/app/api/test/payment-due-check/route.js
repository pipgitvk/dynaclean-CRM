import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import dayjs from "dayjs";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow ADMIN/SUPERADMIN to check
    if (!["SUPERADMIN", "ADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Access denied - Admin only" }, { status: 403 });
    }

    const pool = await getDbConnection();
    const conn = await pool.getConnection();

    try {
      // Get all pending payment orders where due_date is within 5 days
      const today = dayjs().startOf('day');
      const fiveDaysFromNow = today.add(5, 'day').endOf('day');

      const [orders] = await conn.execute(
        `SELECT 
          o.order_id,
          o.client_name,
          o.created_by,
          o.duedate,
          o.totalamt,
          o.payment_amount,
          o.payment_status,
          o.is_returned,
          o.is_cancelled,
          COALESCE(e.empId, r.empId) as empId,
          COALESCE(e.username, r.username) as emp_username
        FROM neworder AS o
        LEFT JOIN emplist AS e ON CAST(o.created_by AS CHAR) = CAST(e.username AS CHAR)
        LEFT JOIN rep_list AS r ON CAST(o.created_by AS CHAR) = CAST(r.username AS CHAR)
        WHERE (o.payment_status IS NULL OR o.payment_status != 'paid')
          AND (o.is_returned = 0 OR o.is_returned = 2 OR o.is_returned IS NULL)
          AND (o.is_cancelled = 0 OR o.is_cancelled IS NULL)
          AND o.duedate IS NOT NULL
          AND DATE(o.duedate) >= DATE(?)
          AND DATE(o.duedate) <= DATE(?)
        ORDER BY o.duedate ASC`,
        [today.format('YYYY-MM-DD'), fiveDaysFromNow.format('YYYY-MM-DD')]
      );

      console.log(`📋 Found ${orders.length} orders with due date within 5 days`);

      // Process and format response
      const processedOrders = orders.map(order => {
        const daysUntilDue = dayjs(order.duedate).diff(today, 'day');
        const dueDateFormatted = dayjs(order.duedate).format("DD MMM YYYY");
        
        const totalAmt = parseFloat(order.totalamt || 0);
        const paidAmt = (order.payment_amount || "")
          .toString()
          .split(",")
          .map(s => parseFloat(s.trim()) || 0)
          .reduce((sum, amt) => sum + amt, 0);
        
        const remainingAmt = totalAmt - paidAmt;

        return {
          order_id: order.order_id,
          client_name: order.client_name,
          created_by: order.created_by,
          emp_username: order.emp_username,
          empId: order.empId,
          duedate: dayjs(order.duedate).format("YYYY-MM-DD HH:mm:ss"),
          days_until_due: daysUntilDue,
          total_amount: totalAmt,
          paid_amount: paidAmt,
          remaining_amount: remainingAmt,
          payment_status: order.payment_status,
          will_notify: remainingAmt > 0 && order.empId ? "✅ YES" : "❌ NO",
          reason: remainingAmt <= 0 ? "No pending payment" : !order.empId ? "Employee not found" : "Will send notification",
          notification_message: remainingAmt > 0 && order.empId 
            ? `💰 Payment Reminder: Order ${order.order_id} from ${order.client_name} is due on ${dueDateFormatted} (${daysUntilDue} days remaining). Pending amount: ₹${remainingAmt.toFixed(2)}`
            : "N/A"
        };
      });

      const willNotifyCount = processedOrders.filter(o => o.will_notify === "✅ YES").length;

      return NextResponse.json({
        success: true,
        summary: {
          total_orders: orders.length,
          orders_that_will_notify: willNotifyCount,
          date_range: `${today.format('YYYY-MM-DD')} to ${fiveDaysFromNow.format('YYYY-MM-DD')}`,
          check_time: dayjs().format("YYYY-MM-DD HH:mm:ss")
        },
        orders: processedOrders,
        note: "Run /api/test/payment-due-notifications to manually trigger the cron job"
      });
    } finally {
      conn.release();
    }
  } catch (error) {
    console.error("Error checking payment due notifications:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
