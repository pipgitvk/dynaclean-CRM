import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  let db;

  try {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    if (!username || !startDate || !endDate) {
      return NextResponse.json(
        { message: "Missing required parameters: username, startDate, endDate" },
        { status: 400 }
      );
    }

    db = await getDbConnection();

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
         AND DATE(no.created_at) >= ?
         AND DATE(no.created_at) <= ?`,
      [username, startDate, endDate]
    );

    const completed_amount = parseFloat(ordersRows[0]?.total_completed_amount || 0);

    return NextResponse.json({
      target,
      completed_amount,
      target_start_date: targetRows[0].target_start_date,
      target_end_date: targetRows[0].target_end_date,
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
