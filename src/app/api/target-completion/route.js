import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { NEWORDER_ACTIVE_FOR_TARGET_SQL } from "@/lib/salesTargetAchievement";
import {
  fetchTargetOrderRows,
  resolveTargetCompletionContext,
} from "@/lib/targetCompletionRange";

export async function GET(request) {
  let db;

  try {
    const url = new URL(request.url);
    const includeOrders = url.searchParams.get("orders") === "1";

    db = await getDbConnection();
    const ctx = await resolveTargetCompletionContext(db, url.searchParams);

    if (!ctx.found) {
      if (ctx.invalidDates) {
        return NextResponse.json(
          { message: "Invalid target date range for this record." },
          { status: 400 },
        );
      }
      if (ctx.missingParams) {
        return NextResponse.json(
          {
            message:
              "Missing required parameters: either targetId, or username + startDate + endDate",
          },
          { status: 400 },
        );
      }
      const empty = {
        target: 0,
        completed_amount: 0,
        approved_order_count: 0,
        rejected_order_count: 0,
        cancelled_order_count: 0,
        message: "No target set for this period.",
      };
      if (includeOrders) {
        empty.orders = {
          approved: [],
          rejected: [],
          cancelled: [],
          pending: [],
        };
      }
      return NextResponse.json(empty);
    }

    const { username, target, orderStart, orderEnd } = ctx;

    let completed_amount = 0;
    let approved_order_count = 0;
    let rejected_order_count = 0;
    let cancelled_order_count = 0;

    if (orderStart <= orderEnd) {
      const orderRangeSql = `
        FROM neworder no
        JOIN quotations_records qr
          ON no.quote_number = qr.quote_number
        WHERE qr.emp_name = ?
          AND DATE(no.created_at) >= ?
          AND DATE(no.created_at) <= ?`;

      const [ordersRows] = await db.execute(
        `SELECT IFNULL(SUM(qi.price_per_unit * qi.quantity), 0) AS total_completed_amount
         FROM neworder no
         JOIN quotations_records qr
           ON no.quote_number = qr.quote_number
         JOIN quotation_items qi
           ON qr.quote_number = qi.quote_number
         WHERE qr.emp_name = ?
           ${NEWORDER_ACTIVE_FOR_TARGET_SQL}
           AND DATE(no.created_at) >= ?
           AND DATE(no.created_at) <= ?`,
        [username, orderStart, orderEnd],
      );
      completed_amount = parseFloat(ordersRows[0]?.total_completed_amount || 0);

      const [countRows] = await db.execute(
        `SELECT
           COUNT(DISTINCT CASE
             WHEN (no.is_cancelled = 0 OR no.is_cancelled IS NULL)
               AND LOWER(TRIM(COALESCE(no.approval_status, ''))) = 'approved'
             THEN no.order_id END
           ) AS approved_order_count,
           COUNT(DISTINCT CASE
             WHEN LOWER(TRIM(COALESCE(no.approval_status, ''))) = 'rejected'
             THEN no.order_id END
           ) AS rejected_order_count,
           COUNT(DISTINCT CASE
             WHEN (no.is_cancelled = 1)
               AND LOWER(TRIM(COALESCE(no.approval_status, ''))) <> 'rejected'
             THEN no.order_id END
           ) AS cancelled_order_count
         ${orderRangeSql}`,
        [username, orderStart, orderEnd],
      );

      approved_order_count = Number(countRows[0]?.approved_order_count || 0);
      rejected_order_count = Number(countRows[0]?.rejected_order_count || 0);
      cancelled_order_count = Number(countRows[0]?.cancelled_order_count || 0);
    }

    const payload = {
      target,
      completed_amount,
      approved_order_count,
      rejected_order_count,
      cancelled_order_count,
      target_start_date: ctx.target_start_date,
      target_end_date: ctx.target_end_date,
      username,
      order_start: orderStart,
      order_end: orderEnd,
      message:
        completed_amount >= target && target > 0
          ? "Congratulations! Target achieved! 🎉"
          : null,
    };

    if (includeOrders) {
      payload.orders = await fetchTargetOrderRows(
        db,
        username,
        orderStart,
        orderEnd,
      );
    }

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Error fetching target completion:", error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 },
    );
  }
}