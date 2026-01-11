import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  let db;

  try {
    const payload = await getSessionPayload();
    if (!payload)
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const username = payload.username;

    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month");
    const yearParam = url.searchParams.get("year");

    const now = new Date();
    const month = monthParam ? Number(monthParam) : now.getMonth() + 1;
    const year = yearParam ? Number(yearParam) : now.getFullYear();

    db = await getDbConnection();

    // Fetch target in the selected month/year
    const [targetRows] = await db.execute(
      `SELECT target, target_start_date, target_end_date
         FROM target
        WHERE username = ?
          AND MONTH(target_start_date) <= ?
          AND MONTH(target_end_date) >= ?
          AND YEAR(target_start_date) <= ?
          AND YEAR(target_end_date) >= ?
        ORDER BY created_at DESC
        LIMIT 1`,
      [username, month, month, year, year]
    );

    if (targetRows.length === 0) {
      return NextResponse.json({
        target: 0,
        completed_orders: 0,
        message: "No target set for this period.",
      });
    }

    const target = parseFloat(targetRows[0].target);

    // Calculate total from quotation items (price_per_unit * quantity) for completed orders
    const [ordersRows] = await db.execute(
      `SELECT IFNULL(SUM(qi.price_per_unit * qi.quantity), 0) AS total_completed_amount
         FROM neworder no
         JOIN quotations_records qr
           ON no.quote_number = qr.quote_number
         JOIN quotation_items qi
           ON qr.quote_number = qi.quote_number
        WHERE qr.emp_name = ?
          AND no.account_status = 1
          AND MONTH(no.created_at) = ?
          AND YEAR(no.created_at) = ?`,
      [username, month, year]
    );

    const completed_orders = parseFloat(ordersRows[0]?.total_completed_amount || 0);

    return NextResponse.json({
      target,
      completed_orders,
      target_start_date: targetRows[0].target_start_date,
      target_end_date: targetRows[0].target_end_date,
      message:
        completed_orders >= target
          ? "Congratulations! Target achieved! 🎉"
          : null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
