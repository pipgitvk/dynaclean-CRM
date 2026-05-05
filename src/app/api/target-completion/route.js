import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

function toYmd(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export async function GET(request) {
  let db;

  try {
    const url = new URL(request.url);
    const targetId = url.searchParams.get("targetId");
    const usernameParam = url.searchParams.get("username");
    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    db = await getDbConnection();

    let username;
    let startDate;
    let endDate;
    let target;
    let responseStartDate;
    let responseEndDate;

    if (targetId) {
      const [byId] = await db.execute(
        `SELECT username, target, target_start_date, target_end_date
         FROM target WHERE id = ?`,
        [targetId]
      );
      if (byId.length === 0) {
        return NextResponse.json({
          target: 0,
          completed_amount: 0,
          message: "No target set for this period.",
        });
      }
      const row = byId[0];
      username = row.username;
      startDate = toYmd(row.target_start_date);
      endDate = toYmd(row.target_end_date);
      target = parseFloat(row.target);
      responseStartDate = row.target_start_date;
      responseEndDate = row.target_end_date;
      if (!startDate || !endDate) {
        return NextResponse.json(
          { message: "Invalid target date range for this record." },
          { status: 400 }
        );
      }
    } else {
      if (!usernameParam || !startDateParam || !endDateParam) {
        return NextResponse.json(
          {
            message:
              "Missing required parameters: either targetId, or username + startDate + endDate",
          },
          { status: 400 }
        );
      }
      username = usernameParam;
      startDate = startDateParam;
      endDate = endDateParam;

      // Fetch target for the user within the date range
      const [targetRows] = await db.execute(
        `SELECT target, target_start_date, target_end_date
         FROM target
         WHERE username = ?
           AND target_start_date <= ?
           AND target_end_date >= ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [username, endDate, startDate]
      );

      if (targetRows.length === 0) {
        return NextResponse.json({
          target: 0,
          completed_amount: 0,
          message: "No target set for this period.",
        });
      }

      target = parseFloat(targetRows[0].target);
      responseStartDate = targetRows[0].target_start_date;
      responseEndDate = targetRows[0].target_end_date;
    }

    const monthParam = url.searchParams.get("month");
    const yearParam = url.searchParams.get("year");

    let orderStart = startDate;
    let orderEnd = endDate;

    if (monthParam != null && yearParam != null) {
      const m = parseInt(monthParam, 10);
      const y = parseInt(yearParam, 10);
      if (m >= 1 && m <= 12 && !Number.isNaN(y) && y >= 2000) {
        const pad = (n) => String(n).padStart(2, "0");
        const lastDay = new Date(y, m, 0).getDate();
        const monthStartStr = `${y}-${pad(m)}-01`;
        const monthEndStr = `${y}-${pad(m)}-${pad(lastDay)}`;
        orderStart = startDate > monthStartStr ? startDate : monthStartStr;
        orderEnd = endDate < monthEndStr ? endDate : monthEndStr;
      }
    }

    // Sum quote line items for super-admin–approved orders in range (gate is approval, not invoice upload)
    let completed_amount = 0;
    if (orderStart <= orderEnd) {
      const [ordersRows] = await db.execute(
        `SELECT IFNULL(SUM(qi.price_per_unit * qi.quantity), 0) AS total_completed_amount
         FROM neworder no
         JOIN quotations_records qr
           ON no.quote_number = qr.quote_number
         JOIN quotation_items qi
           ON qr.quote_number = qi.quote_number
         WHERE qr.emp_name = ?
           AND no.approval_status = 'approved'
           AND DATE(no.created_at) >= ?
           AND DATE(no.created_at) <= ?`,
        [username, orderStart, orderEnd]
      );
      completed_amount = parseFloat(ordersRows[0]?.total_completed_amount || 0);
    }

    return NextResponse.json({
      target,
      completed_amount,
      target_start_date: responseStartDate,
      target_end_date: responseEndDate,
      message:
        completed_amount >= target && target > 0
          ? "Congratulations! Target achieved! 🎉"
          : null,
    });
  } catch (error) {
    console.error("Error fetching target completion:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
