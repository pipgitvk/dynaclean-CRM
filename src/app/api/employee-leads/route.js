import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Authentication token missing." },
        { status: 401 },
      );
    }

    let username;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      username = decoded.username;
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid or expired token." },
        { status: 401 },
      );
    }

    const db = await getDbConnection();

    const { searchParams } = new URL(req.url);
    const campaign = searchParams.get("campaign");

    let customers, quotations, orders;

    if (campaign === "social_media") {
      // Total leads from social media campaign
      const customerQuery = `SELECT * FROM customers WHERE lead_campaign = 'social_media' ORDER BY date_created DESC`;
      [customers] = await db.execute(customerQuery);

      // Quotations created for social media campaign
      const quotationsQuery = `
      SELECT * FROM quotations_records 
      WHERE customer_id IN (SELECT customer_id FROM customers WHERE lead_campaign = 'social_media')
      ORDER BY quote_date DESC
    `;
      [quotations] = await db.execute(quotationsQuery);

      // Orders created for social media campaign
      const ordersQuery = `
      SELECT * FROM neworder 
      WHERE quote_number IN (
        SELECT quote_number FROM quotations_records 
        WHERE customer_id IN (SELECT customer_id FROM customers WHERE lead_campaign = 'social_media')
      ) AND account_status = 1
      ORDER BY invoice_date DESC
    `;
      [orders] = await db.execute(ordersQuery);
    } else {
      // Total leads assigned to the logged-in user
      const customerQuery = `SELECT * FROM customers WHERE assigned_to = ? ORDER BY date_created DESC`;
      [customers] = await db.execute(customerQuery, [username]);

      // Quotations created for leads assigned to the logged-in user
      const quotationsQuery = `
      SELECT * FROM quotations_records 
      WHERE customer_id IN (SELECT customer_id FROM customers WHERE assigned_to = ?)
      ORDER BY quote_date DESC
    `;
      [quotations] = await db.execute(quotationsQuery, [username]);

      // Orders created for leads assigned to the logged-in user
      const ordersQuery = `
      SELECT * FROM neworder 
      WHERE quote_number IN (
        SELECT quote_number FROM quotations_records 
        WHERE customer_id IN (SELECT customer_id FROM customers WHERE assigned_to = ?)
      ) AND account_status = 1
      ORDER BY invoice_date DESC
    `;
      [orders] = await db.execute(ordersQuery, [username]);
    }

    // Create lookup maps
    const customerMap = customers.reduce((acc, c) => {
      acc[c.customer_id] = c;
      return acc;
    }, {});

    const ordersByQuote = orders.reduce((acc, o) => {
      if (!acc[o.quote_number]) {
        acc[o.quote_number] = o;
      }
      return acc;
    }, {});

    // Create flat rows: one row per quotation
    const result = quotations.map((quotation) => {
      const customer = customerMap[quotation.customer_id] || {};
      const order = ordersByQuote[quotation.quote_number] || null;

      // Determine current stage
      let current_stage = "Quotation Created";
      let order_processed = 0;

      if (order) {
        if (order.account_status === 1 && order.dispatch_status === 1) {
          current_stage = "Order Processed";
          order_processed = 1;
        } else if (order.account_status === 1) {
          current_stage = "Order Created";
        }
      }

      return {
        // Customer fields
        customer_id: customer.customer_id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        phone: customer.phone,
        company: customer.company,
        address: customer.address,
        lead_source: customer.lead_source,
        lead_campaign: customer.lead_campaign,
        status: customer.status,
        assigned_to: customer.assigned_to,
        stage: customer.stage,
        date_created: customer.date_created,
        next_follow_date: customer.next_follow_date,

        // Quotation fields
        quote_number: quotation.quote_number,
        quote_date: quotation.quote_date,
        quotation_amount: quotation.grand_total,
        created_by: quotation.emp_name,

        // Order fields
        order_id: order?.order_id,
        invoice_number: order?.invoice_number,
        invoice_date: order?.invoice_date,
        order_amount: order?.totalamt,
        installation_status: order?.installation_status,
        account_status: order?.account_status,
        dispatch_status: order?.dispatch_status,

        // Derived fields
        current_stage,
        order_processed,
      };
    });

    // Add customers with no quotations
    customers.forEach((customer) => {
      const hasQuotation = quotations.some(
        (q) => q.customer_id === customer.customer_id,
      );
      if (!hasQuotation) {
        result.push({
          // Customer fields
          customer_id: customer.customer_id,
          first_name: customer.first_name,
          last_name: customer.last_name,
          email: customer.email,
          phone: customer.phone,
          company: customer.company,
          address: customer.address,
          lead_source: customer.lead_source,
          lead_campaign: customer.lead_campaign,
          status: customer.status,
          assigned_to: customer.assigned_to,
          stage: customer.stage,
          date_created: customer.date_created,
          next_follow_date: customer.next_follow_date,

          // No quotation/order data
          quote_number: null,
          quote_date: null,
          quotation_amount: null,
          created_by: null,
          order_id: null,
          invoice_number: null,
          invoice_date: null,
          order_amount: null,
          installation_status: null,
          account_status: null,
          dispatch_status: null,

          // Derived fields
          current_stage: "Customer Created",
          order_processed: 0,
        });
      }
    });

    return NextResponse.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    console.error("/api/employee-leads error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch employee leads.",
      },
      { status: 500 },
    );
  }
}
