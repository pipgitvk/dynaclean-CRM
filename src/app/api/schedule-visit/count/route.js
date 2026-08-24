import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import { ensureScheduleVisitTable } from "@/lib/ensureScheduleVisitTable";
import { getReportees } from "@/lib/reportingManager";
import { buildScheduleVisitVisibilityWhere } from "@/lib/scheduleVisitScope";

/**
 * GET /api/schedule-visit/count
 * Returns total visit count for dashboard cards.
 */
export async function GET() {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    await ensureScheduleVisitTable();
    const conn = await getDbConnection();
    const username = payload.username;
    const role = payload.role;

    const reportees = await getReportees(username);

    const visibility = buildScheduleVisitVisibilityWhere({
      role,
      username,
      reportees,
    });

    let where = "WHERE 1=1";
    const params = [...visibility.params];

    if (visibility.whereClause) {
      where += ` ${visibility.whereClause}`;
    }

    const fromClause = `schedule_visit ${visibility.join}`;

    const [totalRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM ${fromClause} ${where}`,
      params
    );

    const [pendingRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM ${fromClause} ${where} AND schedule_visit.visit_status = 'pending'`,
      params
    );

    const [approvedRows] = await conn.execute(
      `SELECT COUNT(*) AS total FROM ${fromClause} ${where} AND schedule_visit.visit_status = 'approved'`,
      params
    );

    return NextResponse.json({
      success: true,
      total: Number(totalRows[0]?.total ?? 0),
      pending: Number(pendingRows[0]?.total ?? 0),
      approved: Number(approvedRows[0]?.total ?? 0),
    });
  } catch (error) {
    console.error("GET schedule-visit/count error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch count" },
      { status: 500 }
    );
  }
}
