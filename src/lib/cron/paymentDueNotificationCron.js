import cron from "node-cron";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { getDbConnection, withPool } from "@/lib/db";
import NotificationService from "@/lib/services/NotificationService";

dayjs.extend(utc);
dayjs.extend(timezone);

const GLOBAL_KEY = "__paymentDueNotificationCronStarted__";
const GLOBAL_CRON_JOB_KEY = "__paymentDueNotificationCronJob__";

export async function startPaymentDueNotificationCron() {
  if (global[GLOBAL_KEY]) {
    console.log("ℹ️ Payment due notification cron job already started, skipping...");
    return;
  }

  // Stop any existing cron job first (just in case)
  if (global[GLOBAL_CRON_JOB_KEY]) {
    global[GLOBAL_CRON_JOB_KEY].stop();
  }

  // Create a custom scheduler that checks every minute
  // but only executes at 11:15 AM IST
  const cronJob = cron.schedule("* * * * *", async () => {
    const istTime = dayjs().tz("Asia/Kolkata");
    const hours = istTime.hour();
    const minutes = istTime.minute();
    
    // Check if current time is 11:15 AM IST
    if (hours === 11 && minutes === 15) {
      console.log(`🔄 Running payment due notification cron job at ${istTime.format("YYYY-MM-DD HH:mm:ss")} IST...`);
      await sendPaymentDueNotifications();
    }
  });

  // Store globally
  global[GLOBAL_KEY] = true;
  global[GLOBAL_CRON_JOB_KEY] = cronJob;
  console.log("✅ Payment due notification cron job scheduled (runs daily at 11:15 AM IST)");
}

async function sendPaymentDueNotifications() {
  let conn;
  let pool;
  try {
    pool = await getDbConnection();
    conn = await pool.getConnection();

    console.log("📊 Starting payment due notification check...");

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
        COALESCE(e.empId, r.empId) as empId
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

    if (orders.length === 0) {
      console.log("✅ No pending payment orders due within 5 days");
      return;
    }

    let notificationCount = 0;

    for (const order of orders) {
      try {
        if (!order.empId) {
          console.warn(`⚠️ Skipping order ${order.order_id}: Employee ID not found for ${order.created_by}`);
          continue;
        }

        const daysUntilDue = dayjs(order.duedate).diff(today, 'day');
        const dueDateFormatted = dayjs(order.duedate).format("DD MMM YYYY");
        
        const totalAmt = parseFloat(order.totalamt || 0);
        const paidAmt = (order.payment_amount || "")
          .toString()
          .split(",")
          .map(s => parseFloat(s.trim()) || 0)
          .reduce((sum, amt) => sum + amt, 0);
        
        const remainingAmt = totalAmt - paidAmt;

        if (remainingAmt <= 0) {
          console.log(`⏭️ Skipping order ${order.order_id}: No pending payment`);
          continue;
        }

        // Create notification message
        const message = `💰 Payment Reminder: Order ${order.order_id} from ${order.client_name} is due on ${dueDateFormatted} (${daysUntilDue} days remaining). Pending amount: ₹${remainingAmt.toFixed(2)}`;

        // Get all superadmin empIds
        const [superadmins] = await conn.execute(
          `SELECT empId FROM emplist WHERE userRole = 'SUPERADMIN'`
        );

        // Send notification to sales person (order creator)
        await conn.execute(
          `INSERT INTO notifications (user_id, message, type, related_id, created_at)
           VALUES (?, ?, 'payment_due', ?, NOW())`,
          [order.empId, message, order.order_id]
        );
        notificationCount++;
        console.log(`✅ Notification sent to sales person ${order.created_by} for order ${order.order_id}`);

        // Send notification to all superadmins
        for (const superadmin of superadmins) {
          const superadminMessage = `📊 [ADMIN] ${message} (Sales: ${order.created_by})`;
          await conn.execute(
            `INSERT INTO notifications (user_id, message, type, related_id, created_at)
             VALUES (?, ?, 'payment_due_admin', ?, NOW())`,
            [superadmin.empId, superadminMessage, order.order_id]
          );
          notificationCount++;
          console.log(`✅ Admin notification sent to SUPERADMIN for order ${order.order_id}`);
        }
      } catch (error) {
        console.error(`❌ Error creating notification for order ${order.order_id}:`, error);
      }
    }

    console.log(`📊 Cron job completed: ${notificationCount} notifications sent`);
  } catch (error) {
    console.error("❌ Error in payment due notification cron job:", error);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseError) {
        console.error("❌ Error releasing database connection:", releaseError);
      }
    }
  }
}

export async function manualSendPaymentDueNotifications() {
  console.log("🔄 Manually triggering payment due notification check...");
  await sendPaymentDueNotifications();
}
