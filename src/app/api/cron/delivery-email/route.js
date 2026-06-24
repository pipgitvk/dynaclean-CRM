/**
 * GET /api/cron/delivery-email
 * Daily cron: sends delivery reminders for orders with expected delivery date = today (COD orders only)
 * Schedule: Daily at any time (e.g., 8am) - will find and email orders matching today's date
 * Auth: ?secret=CRON_SECRET OR Authorization: Bearer CRON_SECRET
 */

import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { sendImportCrmSmtpEmail } from "@/lib/importCrmEmail";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const authHeader = request.headers.get("authorization");
    const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    const cronSecret = process.env.CRON_SECRET;

    // Verify cron secret
    if (cronSecret) {
      // If CRON_SECRET is set, one of the auth methods must match
      const isValidSecret = (secret && secret === cronSecret) || (bearerToken && bearerToken === cronSecret);
      if (!isValidSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const conn = await getDbConnection();

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Step 1: Fetch all orders with delivery_date = today AND have booking_id
    const [ordersToEmail] = await conn.execute(
      `SELECT 
        no.order_id,
        no.booking_id,
        no.client_name,
        no.email,
        no.totalamt,
        no.payment_amount,
        no.delivery_date,
        no.delivery_location,
        no.quote_number
      FROM neworder no
      WHERE DATE(no.delivery_date) = ?
      AND no.email IS NOT NULL
      AND no.email != ''
      AND no.booking_id IS NOT NULL
      ORDER BY no.order_id DESC`,
      [today]
    );

    if (!Array.isArray(ordersToEmail) || ordersToEmail.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orders with delivery date today",
        ordersProcessed: 0,
      });
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const results = [];

    // Step 2: For each order, verify it's COD and send email
    for (const order of ordersToEmail) {
      try {
        // Verify payment_term_days = 9 (COD)
        const [qRows] = await conn.execute(
          `SELECT payment_term_days FROM quotations_records WHERE quote_number = ?`,
          [order.quote_number]
        );

        const paymentTermDays = Array.isArray(qRows) && qRows.length 
          ? Number(qRows[0]?.payment_term_days) || 0 
          : 0;

        console.log(`Order ${order.order_id}: quote_number=${order.quote_number}, paymentTermDays=${paymentTermDays}`);

        // If quotation doesn't exist or payment_term_days is not 9, skip
        if (!order.quote_number) {
          results.push({
            order_id: order.order_id,
            status: "skipped",
            reason: "No quote_number found",
          });
          continue;
        }

        if (paymentTermDays !== 9) {
          results.push({
            order_id: order.order_id,
            status: "skipped",
            reason: `Not a COD order (payment_term_days=${paymentTermDays}, quote_number=${order.quote_number})`,
            quote_number: order.quote_number,
          });
          continue;
        }

        // Calculate pending amount
        let paidAmount = 0;
        if (order.payment_amount) {
          const amounts = order.payment_amount.toString().split(',').map(a => parseFloat(a.trim()) || 0);
          paidAmount = amounts.reduce((sum, amt) => sum + amt, 0);
        }
        const pending_amount = (order.totalamt || 0) - paidAmount;

        // Build email content with professional template
        const deliveryDate = new Date(order.delivery_date).toLocaleDateString('en-IN');

        // Fetch total from quotation if not in order
        let totalAmount = Number(order.totalamt) || 0;
        if (totalAmount === 0 && order.quote_number) {
          const [quotRows] = await conn.execute(
            `SELECT SUM(total_price) as total FROM quotation_items WHERE quote_number = ?`,
            [order.quote_number]
          );
          if (quotRows && quotRows.length && quotRows[0].total) {
            totalAmount = Number(quotRows[0].total) || 0;
          }
        }

        // Recalculate with correct total
        paidAmount = 0;
        if (order.payment_amount) {
          const amounts = order.payment_amount.toString().split(',').map(a => parseFloat(a.trim()) || 0);
          paidAmount = amounts.reduce((sum, amt) => sum + amt, 0);
        }
        const correctPending = totalAmount - paidAmount;

        const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Delivery Today</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #f4f6f8;
      font-family: Arial, Helvetica, sans-serif;
      color: #333333;
    }
    .wrapper {
      width: 100%;
      padding: 20px 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 6px;
      overflow: hidden;
    }
    .header {
      text-align: center;
      padding: 25px;
      border-bottom: 3px solid #FF6B6B;
    }
    .header img {
      max-width: 180px;
      pointer-events: none;
      user-select: none;
      -webkit-user-drag: none;
      -moz-user-select: none;
      -webkit-user-select: none;
      -ms-user-select: none;
    }
    .content {
      padding: 30px;
    }
    h1 {
      font-size: 32px;
      color: #000000;
      font-weight: bold;
      margin: 0 0 15px 0;
      text-align: center;
    }
    h2 {
      font-size: 18px;
      color: #FF6B6B;
      margin: 30px 0 10px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 12px;
    }
    .highlight-box {
      background-color: #FFE8E8;
      border-left: 4px solid #FF6B6B;
      padding: 18px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .tracking-box {
      background: #FF6B6B;
      color: #ffffff;
      text-align: center;
      padding: 25px;
      border-radius: 6px;
      margin: 25px 0;
    }
    .tracking-id {
      font-size: 26px;
      font-weight: bold;
      letter-spacing: 1px;
      margin: 10px 0;
    }
    .btn {
      display: inline-block;
      margin-top: 15px;
      background-color: #ffffff;
      color: #FF6B6B;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 4px;
      font-size: 15px;
      font-weight: bold;
    }
    table.info-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    table.info-table td {
      padding: 8px 0;
      font-size: 14px;
    }
    table.info-table td.label {
      color: #777777;
      width: 40%;
      font-weight: bold;
    }
    .address-box {
      background-color: #F9F9F9;
      padding: 15px;
      border-left: 4px solid #FF6B6B;
      border-radius: 4px;
      font-size: 14px;
    }
    .footer {
      background-color: #fafafa;
      border-top: 1px solid #e0e0e0;
      text-align: center;
      padding: 20px;
      font-size: 12px;
      color: #777777;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <img src="https://app.dynacleanindustries.com/dynaclean_logo.png" alt="DynaClean Industries" style="max-width: 180px; display: block; pointer-events: none; user-select: none; -webkit-user-drag: none;">
      </div>
      
      <!-- Content -->
      <div class="content">
        <h1>Your delivery arriving soon</h1>
        <p style="font-size: 16px; color: #333; font-weight: bold; margin: 15px 0;">Dear ${order.client_name || 'Valued Customer'},</p>
        <p style="font-size: 16px; color: #666; margin: 15px 0;">Your order is arriving today! Be ready to receive your package.</p>
        
        <!-- Delivery Info -->
        <h2>Delivery Details</h2>
        <p style="font-size: 16px; color: #FF6B6B; font-weight: bold; margin: 10px 0 25px 0;">${deliveryDate}</p>
        
        <!-- Tracking -->
        <div class="tracking-box">
          <p style="margin:0;font-size:13px;opacity:0.9;">Tracking ID</p>
          <div class="tracking-id">${order.booking_id}</div>
          <a href="${order.booking_url || '#'}" class="btn">Track Your Shipment</a>
        </div>
        
        <!-- Order Details -->
        <h2>Order Details</h2>
        <div class="highlight-box">
          <table class="info-table">
            <tr>
              <td class="label">Order ID</td>
              <td>${order.order_id}</td>
            </tr>
            <tr>
              <td class="label">Customer Name</td>
              <td>${order.client_name || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Amount Due</td>
              <td style="color: #FF6B6B; font-weight: bold;">₹${correctPending.toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <!-- Delivery Address -->
        <h2>Delivery Address</h2>
        <div class="address-box">
          📍 ${order.delivery_location || 'N/A'}
        </div>
        
        <!-- Checklist -->
        <div style="background: #E8F5E9; border-left: 5px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0 0 12px 0; color: #2E7D32; font-size: 16px; font-weight: bold;">✅ Get Ready for Delivery</p>
          <ul style="margin: 5px 0; padding-left: 20px; color: #2E7D32;">
            <li>Keep exactly <strong>₹${correctPending.toFixed(2)}</strong> ready</li>
            <li>Be available to receive the package</li>
            <li>Our team will call you before arrival</li>
            <li>Inspect the package before accepting</li>
            <li>Payment accepted: Cash / UPI / Card</li>
          </ul>
        </div>
        
        <!-- Warning -->
        <div style="background: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⚠️ Important:</strong> If you need to reschedule, contact us before 5 PM today.</p>
        </div>
        
        <p style="font-size: 16px; color: #666; margin: 25px 0;">Thank you for choosing <strong>DynaClean Industries</strong>.</p>
        
        <!-- Need Assistance -->
        <div style="background: #E8F5E9; border-left: 5px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0 0 12px 0; color: #2E7D32; font-size: 16px; font-weight: bold;">Need Assistance?</p>
          <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>📞 +91 9289001127</strong> (Mon–Sat, 9:30 AM – 6:30 PM)</p>
          <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>📞 8287213519</strong></p>
          <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>📧 service@dynacleanindustries.com</strong></p>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} DynaClean Industries. All rights reserved.</p>
        <p>This is an automated email. Please do not reply.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

        // Send email
        await sendImportCrmSmtpEmail({
          to: order.email,
          subject: `🚚 Delivery Today - Order #${order.order_id} | Tracking: ${order.booking_id}`,
          html: emailHtml,
        });

        emailsSent++;
        results.push({
          order_id: order.order_id,
          status: "sent",
          email: order.email,
        });

        console.log(`✅ Delivery email sent for Order ${order.order_id}`);
      } catch (emailError) {
        emailsFailed++;
        results.push({
          order_id: order.order_id,
          status: "failed",
          error: emailError.message,
        });
        console.error(`❌ Failed to send delivery email for Order ${order.order_id}:`, emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Delivery email cron job completed",
      ordersProcessed: ordersToEmail.length,
      emailsSent,
      emailsFailed,
      results,
      executedAt: new Date().toISOString(),
      date: today,
    });
  } catch (error) {
    console.error("❌ Delivery Email Cron Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Cron job failed",
      },
      { status: 500 }
    );
  }
}
