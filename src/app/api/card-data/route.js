// pages/api/card-data/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  // ✅ Extract username from JWT in cookies


  const payload = await getSessionPayload();
  if (!payload) {
    // You can handle unauthorized access here, e.g., redirect or return an error
    return null;
  }

  const username = payload.username;

  try {
    const db = await getDbConnection();

    // 1. Get the number of distinct quotations
    const [quotationsCountResult] = await db.execute(
      "SELECT COUNT(DISTINCT quote_number) as count FROM quotations_records WHERE emp_name = ?",
      [username]
    );
    const quotationsCount = quotationsCountResult[0].count;

    // 2. Get the number of "very good" customers
    const [customersCountResult] = await db.execute(
      'SELECT COUNT(*) as count FROM customers WHERE lead_source = ? AND status = "Very Good"',
      [username]
    );
    const customersCount = customersCountResult[0].count;

    // 3. Get the number of new orders with an invoice
    const [ordersCountResult] = await db.execute(
      'SELECT COUNT(*) as count FROM neworder WHERE invoice_number IS NOT NULL AND invoice_number != "" AND created_by = ?',
      [username]
    );
    const ordersCount = ordersCountResult[0].count;

    return NextResponse.json({
      username,
      quotationsCount,
      customersCount,
      ordersCount,
    });
  } catch (error) {
    console.error("Database query error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data." },
      { status: 500 }
    );
  }
}