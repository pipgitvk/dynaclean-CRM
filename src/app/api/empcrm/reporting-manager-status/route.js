import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getReportees } from "@/lib/reportingManager";
import { getDbConnection } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSessionPayload();
    if (!session?.username) {
      return NextResponse.json(
        { success: false, hasReportees: false },
        { status: 401 }
      );
    }

    const reportees = await getReportees(session.username);
    const hasReportees = reportees.length > 0;

    let pendingLeavesCount = 0;
    let pendingExpensesCount = 0;

    if (hasReportees) {
      const conn = await getDbConnection();
      const placeholders = reportees.map(() => "?").join(", ");
      
      // Get pending leaves count
      const [leaveRows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM employee_leaves 
         WHERE username IN (${placeholders}) AND status = 'pending'`,
        reportees
      );
      pendingLeavesCount = leaveRows[0]?.cnt || 0;

      // Get pending expenses count for current month
      const today = new Date();
      const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const fromDate = currentMonthStart.toISOString().split('T')[0];
      const toDate = currentMonthEnd.toISOString().split('T')[0];

      const [expenseRows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM expenses 
         WHERE username IN (${placeholders}) 
         AND approval_status = 'Pending'
         AND TravelDate >= ? AND TravelDate <= ?`,
        [...reportees, fromDate, toDate]
      );
      pendingExpensesCount = expenseRows[0]?.cnt || 0;
    }

    return NextResponse.json({
      success: true,
      hasReportees,
      pendingLeavesCount,
      pendingExpensesCount,
    });
  } catch (error) {
    console.error("Reporting manager status error:", error);
    return NextResponse.json(
      { success: false, hasReportees: false },
      { status: 500 }
    );
  }
}
