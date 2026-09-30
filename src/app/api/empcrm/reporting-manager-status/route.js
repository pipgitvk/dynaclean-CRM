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
    if (hasReportees) {
      const conn = await getDbConnection();
      const placeholders = reportees.map(() => "?").join(", ");
      const [rows] = await conn.execute(
        `SELECT COUNT(*) as cnt FROM employee_leaves 
         WHERE username IN (${placeholders}) AND status = 'pending'`,
        reportees
      );
      pendingLeavesCount = rows[0]?.cnt || 0;
    }

    return NextResponse.json({
      success: true,
      hasReportees,
      pendingLeavesCount,
    });
  } catch (error) {
    console.error("Reporting manager status error:", error);
    return NextResponse.json(
      { success: false, hasReportees: false },
      { status: 500 }
    );
  }
}
