// pages/api/card-data/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { getSessionPayload } from "@/lib/auth";

function getMonthDateRange(searchParams) {
  const period = searchParams.get("period");
  let month = searchParams.get("month");
  let year = searchParams.get("year");

  if (period === "month") {
    const now = new Date();
    month = String(now.getMonth() + 1);
    year = String(now.getFullYear());
  }

  if (!month || !year) return null;

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (m < 1 || m > 12 || Number.isNaN(y) || y < 2000) return null;

  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(y, m, 0).getDate();

  return {
    startDate: `${y}-${pad(m)}-01`,
    endDate: `${y}-${pad(m)}-${pad(lastDay)}`,
  };
}

export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = payload.username;
  const { searchParams } = new URL(req.url);
  const monthRange = getMonthDateRange(searchParams);

  try {
    const db = await getDbConnection();

    // 1. Get the number of distinct quotations
    let quotationsQuery =
      "SELECT COUNT(DISTINCT quote_number) as count FROM quotations_records WHERE emp_name = ?";
    const quotationsParams = [username];
    if (monthRange) {
      quotationsQuery +=
        " AND DATE(created_at) >= ? AND DATE(created_at) <= ?";
      quotationsParams.push(monthRange.startDate, monthRange.endDate);
    }
    const [quotationsCountResult] = await db.execute(
      quotationsQuery,
      quotationsParams
    );
    const quotationsCount = quotationsCountResult[0].count;

    // 2. Get the number of "very good" customers
    let customersQuery =
      'SELECT COUNT(*) as count FROM customers WHERE lead_source = ? AND status = "Very Good"';
    const customersParams = [username];
    if (monthRange) {
      customersQuery +=
        " AND DATE(date_created) >= ? AND DATE(date_created) <= ?";
      customersParams.push(monthRange.startDate, monthRange.endDate);
    }
    const [customersCountResult] = await db.execute(
      customersQuery,
      customersParams
    );
    const customersCount = customersCountResult[0].count;

    // 3. Get the number of new orders with an invoice
    let ordersQuery =
      'SELECT COUNT(*) as count FROM neworder WHERE invoice_number IS NOT NULL AND invoice_number != "" AND created_by = ?';
    const ordersParams = [username];
    if (monthRange) {
      ordersQuery += " AND DATE(created_at) >= ? AND DATE(created_at) <= ?";
      ordersParams.push(monthRange.startDate, monthRange.endDate);
    }
    const [ordersCountResult] = await db.execute(ordersQuery, ordersParams);
    const ordersCount = ordersCountResult[0].count;

    return NextResponse.json({
      username,
      quotationsCount,
      customersCount,
      ordersCount,
      period: monthRange ? "month" : "all",
      monthStart: monthRange?.startDate ?? null,
      monthEnd: monthRange?.endDate ?? null,
    });
  } catch (error) {
    console.error("Database query error:", error);
    const msg = String(error?.message || "");
    if (msg.toLowerCase().includes("too many connections")) {
      return NextResponse.json({
        username,
        quotationsCount: 0,
        customersCount: 0,
        ordersCount: 0,
        warning: "DB overloaded (too many connections)",
      });
    }
    return NextResponse.json({ error: "Failed to fetch dashboard data." }, { status: 500 });
  }
}