import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(request.url);

  try {
    // Get month and year from query params (defaults to current month)
    const month = parseInt(searchParams.get("month")) || new Date().getMonth() + 1;
    const year = parseInt(searchParams.get("year")) || new Date().getFullYear();

    // Create date range for the selected month
    const pad = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const monthStartStr = `${year}-${pad(month)}-01`;
    const monthEndStr = `${year}-${pad(month)}-${pad(lastDay)}`;

    console.log(`[Top Achievers] Fetching for month: ${monthStartStr} to ${monthEndStr}`);

    // Get all targets active in this month with their achievement
    // Using SAME logic as Monitor-Targets (uses qr.emp_name from quotations_records)
    const [targets] = await conn.execute(`
      SELECT 
        t.id,
        t.username,
        t.target,
        t.target_start_date,
        t.target_end_date,
        COALESCE(SUM(COALESCE(qi.total_taxable_amt, qi.taxable_price, qi.price_per_unit * qi.quantity, 0)), 0) as achieved_amount
      FROM target t
      LEFT JOIN quotations_records qr 
        ON CAST(qr.emp_name AS CHAR) = CAST(t.username AS CHAR) COLLATE utf8mb4_unicode_ci
      LEFT JOIN neworder no 
        ON no.quote_number = qr.quote_number
        AND no.approval_status = 'approved'
        AND DATE(no.created_at) >= ?
        AND DATE(no.created_at) <= ?
      LEFT JOIN quotation_items qi 
        ON qi.quote_number = no.quote_number
      WHERE DATE(t.target_start_date) <= ?
        AND DATE(t.target_end_date) >= ?
      GROUP BY t.id, t.username, t.target
      ORDER BY 
        CASE 
          WHEN t.target > 0 
          THEN (COALESCE(SUM(COALESCE(qi.total_taxable_amt, qi.taxable_price, qi.price_per_unit * qi.quantity, 0)), 0) / t.target * 100) 
          ELSE 0 
        END DESC
    `, [monthStartStr, monthEndStr, monthEndStr, monthStartStr]);

    console.log(`[Top Achievers] Query results:`, JSON.stringify(targets, null, 2));

    // Calculate achievement percentage for each target
    const topAchievers = targets.map((target) => {
      const achievementPercent = target.target > 0 
        ? (target.achieved_amount / target.target * 100).toFixed(1)
        : 0;
      
      console.log(`[Top Achievers] ${target.username}: achieved=${target.achieved_amount}, target=${target.target}, percent=${achievementPercent}%`);
      
      return {
        username: target.username,
        target: parseFloat(target.target),
        achieved: parseFloat(target.achieved_amount),
        achievement_percent: parseFloat(achievementPercent),
        status: achievementPercent >= 100 ? 'Achieved' : 'In Progress',
        shortfall: Math.max(0, target.target - target.achieved_amount)
      };
    });

    console.log(`[Top Achievers] Final response:`, JSON.stringify(topAchievers, null, 2));

    return NextResponse.json({
      success: true,
      month,
      year,
      data: topAchievers
    });

  } catch (error) {
    console.error("Error fetching top achievers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch top achievers", details: error.message },
      { status: 500 }
    );
  }
}
