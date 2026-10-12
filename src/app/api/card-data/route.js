// pages/api/card-data/route.js

import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getTodayYmdIST } from "@/lib/prospectCommitmentRules";
import { mysqlBoundsForIstDateRange } from "@/lib/timezone";
import { countVeryGoodFollowupsToday } from "@/lib/veryGoodFollowupTodaySql";

function getDateRange(searchParams) {
  const period = searchParams.get("period");
  const pad = (n) => String(n).padStart(2, "0");

  if (period === "today") {
    const today = getTodayYmdIST();
    return {
      startDate: today,
      endDate: today,
      period: "today",
    };
  }

  let month = searchParams.get("month");
  let year = searchParams.get("year");

  if (period === "month") {
    const todayIst = getTodayYmdIST();
    const [y, m] = todayIst.split("-");
    month = m;
    year = y;
  }

  if (!month || !year) return null;

  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (m < 1 || m > 12 || Number.isNaN(y) || y < 2000) return null;

  const lastDay = new Date(y, m, 0).getDate();

  return {
    startDate: `${y}-${pad(m)}-01`,
    endDate: `${y}-${pad(m)}-${pad(lastDay)}`,
    period: "month",
  };
}

export async function GET(req) {
  const payload = await getSessionPayload();
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const username = payload.username;
  const userRole = payload.role;
  const isSalesCumBackoffice = userRole === "SALES CUM BACKOFFICE";
  const { searchParams } = new URL(req.url);
  const dateRange = getDateRange(searchParams);
  const createdDateBounds = dateRange
    ? mysqlBoundsForIstDateRange(dateRange.startDate, dateRange.endDate)
    : null;

  try {
    const db = await getDbConnection();

    // 1. Get the number of distinct quotations
    let quotationsQuery =
      "SELECT COUNT(DISTINCT quote_number) as count FROM quotations_records WHERE emp_name = ?";
    const quotationsParams = [username];
    if (dateRange) {
      quotationsQuery +=
        " AND DATE(created_at) >= ? AND DATE(created_at) <= ?";
      quotationsParams.push(dateRange.startDate, dateRange.endDate);
    }
    const [quotationsCountResult] = await db.execute(
      quotationsQuery,
      quotationsParams
    );
    const quotationsCount = quotationsCountResult[0].count;

    // 2. Very Good customers
    let customersCount = 0;
    if (dateRange?.period === "today") {
      customersCount = await countVeryGoodFollowupsToday(
        db,
        username,
        isSalesCumBackoffice,
      );
    } else {
      let customersQuery = isSalesCumBackoffice
        ? 'SELECT COUNT(*) as count FROM customers WHERE status = "Very Good"'
        : `SELECT COUNT(*) as count FROM customers
           WHERE (lead_source = ? OR sales_representative = ? OR assigned_to = ?)
           AND status = "Very Good"`;
      const customersParams = isSalesCumBackoffice
        ? []
        : [username, username, username];
      if (createdDateBounds) {
        customersQuery += " AND date_created >= ? AND date_created <= ?";
        customersParams.push(createdDateBounds.start, createdDateBounds.end);
      }
      const [customersCountResult] = await db.execute(
        customersQuery,
        customersParams,
      );
      customersCount = customersCountResult[0].count;
    }

    // 3. Get the number of new orders with an invoice
    let ordersQuery =
      'SELECT COUNT(*) as count FROM neworder WHERE invoice_number IS NOT NULL AND invoice_number != "" AND created_by = ?';
    const ordersParams = [username];
    if (createdDateBounds) {
      ordersQuery += " AND created_at >= ? AND created_at <= ?";
      ordersParams.push(createdDateBounds.start, createdDateBounds.end);
    }
    const [ordersCountResult] = await db.execute(ordersQuery, ordersParams);
    const ordersCount = ordersCountResult[0].count;

    return NextResponse.json({
      username,
      quotationsCount,
      customersCount,
      ordersCount,
      period: dateRange?.period ?? "all",
      monthStart: dateRange?.startDate ?? null,
      monthEnd: dateRange?.endDate ?? null,
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