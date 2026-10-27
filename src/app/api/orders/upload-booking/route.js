import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { sendImportCrmSmtpEmail } from "@/lib/importCrmEmail";

export async function POST(req) {
  try {
    const body = await req.json();
    const {
      orderId,
      booking_id,
      booking_date,
      booking_url,
      adminremark,
      expected_delivery_date
    } = body;

    if (!orderId || !booking_id || !booking_date || !booking_url) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (!adminremark || adminremark.trim() === '') {
      return NextResponse.json({ error: "Admin Remark is required" }, { status: 400 });
    }

    console.log('This is the correct we should get orderId:', orderId);

    const conn = await getDbConnection();
    const payload = await getSessionPayload();
    const bookingBy = payload?.username || payload?.name || null;

    // ✅ Step 1: Fetch order details for email
    const [orderRows] = await conn.execute(
      `SELECT order_id, client_name, email, totalamt, payment_amount, quote_number, delivery_location FROM neworder WHERE order_id = ?`,
      [orderId]
    );

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];
    
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
    
    console.log(`📊 Raw Order Data - orderid: ${order.order_id}, totalamt: ${order.totalamt}, quote_total: ${totalAmount}, payment_amount: ${order.payment_amount}`);
    
    // Fetch payment_term_days from quotation
    let paymentTermDays = 0;
    if (order.quote_number) {
      const [qRows] = await conn.execute(
        `SELECT payment_term_days FROM quotations_records WHERE quote_number = ?`,
        [order.quote_number]
      );
      if (Array.isArray(qRows) && qRows.length) {
        paymentTermDays = Number(qRows[0]?.payment_term_days) || 0;
      }
    }
    
    // Update booking for all orders (email sent to all payment terms)
    
    // Parse payment_amount (it might be comma-separated if multiple payments exist)
    let paidAmount = 0;
    if (order.payment_amount) {
      const amounts = order.payment_amount.toString().split(',').map(a => parseFloat(a.trim()) || 0);
      paidAmount = amounts.reduce((sum, amt) => sum + amt, 0);
    }
    
    const pending_amount = totalAmount - paidAmount;
    
    console.log(`📊 Order ${orderId}: Total=${totalAmount}, Paid=${paidAmount}, Pending=${pending_amount}`);

    // ✅ Step 2: Update neworder table with booking info
    await conn.execute(
      `UPDATE neworder SET 
        booking_url = ?, 
        booking_id = ?, 
        booking_date = ?, 
        admin_status = ?, 
        booking_by = ?, 
        admin_remark = ?,
        delivery_date = ?
    WHERE order_id = ?`,
      [booking_url, booking_id, booking_date, 1, bookingBy, adminremark, expected_delivery_date, orderId]
    );

    // ✅ Step 3: Send email with custom template (not from database)
    try {
      // Fetch dispatched items from quotation_items
      let itemDetailsHtml = '';
      if (order.quote_number) {
        const [itemRows] = await conn.execute(
          `SELECT item_name, item_code, specification, quantity, unit, total_price 
           FROM quotation_items WHERE quote_number = ?`,
          [order.quote_number]
        );

        // Build items table
        const itemRows2col = itemRows.map((item, i) => `
          <tr style="background:${i % 2 === 0 ? '#f3e8ff' : '#fff'};">
            <td style="padding:10px 14px;font-weight:bold;color:#333;">${item.item_name || 'N/A'}</td>
            <td style="padding:10px 14px;color:#333;">Qty: ${item.quantity || 0} ${item.unit || ''} &nbsp;|&nbsp; <strong>₹${Number(item.total_price || 0).toLocaleString('en-IN')}</strong></td>
          </tr>
        `).join('');

        itemDetailsHtml = `
          <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;">
            <thead>
              <tr style="background:#8B008B;color:white;">
                <th style="padding:10px 14px;text-align:left;">Detail</th>
                <th style="padding:10px 14px;text-align:left;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${itemRows2col}
              <tr style="background:${itemRows.length % 2 === 0 ? '#f3e8ff' : '#fff'};">
                <td style="padding:10px 14px;font-weight:bold;">Paid Amount</td>
                <td style="padding:10px 14px;color:#27ae60;font-weight:bold;">₹${paidAmount.toFixed(2)}</td>
              </tr>
              <tr style="background:${(itemRows.length + 1) % 2 === 0 ? '#f3e8ff' : '#fff'};">
                <td style="padding:10px 14px;font-weight:bold;">Amount Due${paymentTermDays === 9 ? ' (COD)' : ''}</td>
                <td style="padding:10px 14px;color:#c0392b;font-weight:bold;">₹${pending_amount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        `;
      }

      // Build custom email template directly
      const customEmailTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Dispatched</title>
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
      border-bottom: 3px solid #4DA8DA;
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
      font-size: 22px;
      color: #2C3E50;
      margin: 0 0 15px 0;
    }
    h2 {
      font-size: 18px;
      color: #4DA8DA;
      margin: 30px 0 10px;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      margin: 0 0 12px;
    }
    .highlight-box {
      background-color: #E8F4F8;
      border-left: 4px solid #4DA8DA;
      padding: 18px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .tracking-box {
      background: #4DA8DA;
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
      color: #4DA8DA;
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
      border-left: 4px solid #4DA8DA;
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
        <h1 style="font-size: 32px; color: #000000; font-weight: bold; margin: 15px 0; text-align: center;">Your Booking Order Confirmed</h1>
        <p style="font-size: 16px; color: #333; font-weight: bold; margin: 15px 0;">Dear ${order.client_name || 'Valued Customer'},</p>
        <p style="font-size: 16px; color: #666; margin: 15px 0;">We're pleased to inform you that your order has been confirmed successfully.</p>
        
        <!-- Delivery Info -->
        <h2 style="color: #10b981; font-weight: bold;">Expected Delivery: <span style="font-size: 24px; color: #10b981; font-weight: bold;">${new Date(expected_delivery_date).toLocaleDateString('en-IN')}</span></h2>
        
        <!-- Tracking -->
        <div class="tracking-box">
          <p style="margin:0;font-size:13px;opacity:0.9;">Tracking ID</p>
          <div class="tracking-id">${booking_id}</div>
          <a href="${booking_url}" class="btn">Track Your Shipment</a>
        </div>
        
        <!-- Order Details -->
        <h2>Order Details</h2>
        <div class="highlight-box">
          <table class="info-table">
            <tr>
              <td class="label">Order ID</td>
              <td>${orderId}</td>
            </tr>
            <tr>
              <td class="label">Customer Name</td>
              <td>${order.client_name || 'N/A'}</td>
            </tr>
            <tr>
              <td class="label">Delivery Location</td>
              <td>${order.delivery_location || 'N/A'}</td>
            </tr>
          </table>
        </div>
        
        <!-- Delivery Address -->
        <h2>Delivery Address</h2>
        <div class="address-box">
          📍 ${order.delivery_location || 'N/A'}
        </div>
        
        <!-- Items -->
        <h2>Order Items</h2>
        ${itemDetailsHtml}
        
        <!-- Warning & Note -->
        ${paymentTermDays === 9 ? `<div style="background: #fff3cd; border-left: 5px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0; color: #856404; font-size: 14px;"><strong>⚠️ Please ensure cash availability at the time of delivery</strong></p>
        </div>
        
        <div style="background: #f8f9fa; border: 1px solid #dee2e6; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0 0 10px 0; color: #333; font-size: 14px;"><strong>Note:</strong></p>
          <p style="margin: 0; color: #666; font-size: 14px;">In case of COD amount not paid at the time of delivery, shipment may be returned and delivery charges will be applied.</p>
        </div>` : ''}
        
        <p style="font-size: 16px; color: #666; margin: 25px 0;">Thank you for choosing <strong>DynaClean Industries</strong>.</p>
        
        <!-- Need Assistance -->
        <div style="background: #E8F5E9; border-left: 5px solid #4CAF50; padding: 15px; margin: 20px 0; border-radius: 5px;">
          <p style="margin: 0 0 12px 0; color: #2E7D32; font-size: 16px; font-weight: bold;">Need Assistance?</p>
          <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>📞 8287213519</strong></p>
          <p style="margin: 5px 0; color: #333; font-size: 14px;"><strong>📞 +91 9289001127</strong> (Mon–Sat, 9:30 AM – 6:30 PM)</p>
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

      const emailData = {
        order_id: orderId,
        company_name: order.client_name || 'Valued Customer',
        client_name: order.client_name || 'Valued Customer',
        customer_name: order.client_name || 'Valued Customer',
        delivery_location: order.delivery_location || 'N/A',
        booking_id: booking_id,
        booking_url: booking_url,
        expected_delivery_date: new Date(expected_delivery_date).toLocaleDateString('en-IN'),
        pending_amount: `₹${pending_amount.toFixed(2)}`,
        current_year: new Date().getFullYear().toString(),
      };

      console.log(`📧 Sending email to: ${order.email}`);
      
      await sendImportCrmSmtpEmail({
        to: order.email,
        subject: `✅ Booking Confirmed - Order #${orderId} | Tracking: ${booking_id}`,
        html: customEmailTemplate,
      });

      console.log('✅ Booking confirmation email sent with custom template');
    } catch (emailError) {
      console.error('⚠️ Email Error Details:', {
        error: emailError.message,
        code: emailError.code,
        response: emailError.response,
        stack: emailError.stack
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Booking Upload Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
