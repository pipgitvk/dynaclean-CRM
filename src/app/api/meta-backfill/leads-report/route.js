/**
 * GET /api/meta-backfill/leads-report?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Returns: leads count per employee (assigned_to) + total leads in date range
 */
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const role = payload.role?.toUpperCase() || "";
    if (!["ADMIN", "SUPERADMIN"].includes(role)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' date (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    const conn = await getDbConnection();

    // All reps from lead_distribution (who receive leads)
    const [allReps] = await conn.execute(
      `SELECT username FROM lead_distribution WHERE is_active = 1 ORDER BY priority ASC`
    );

    // Leads count per employee in date range
    const [byEmployee] = await conn.execute(
      `SELECT 
        COALESCE(assigned_to, 'Unassigned') as employee,
        COUNT(*) as lead_count
       FROM customers
       WHERE DATE(date_created) BETWEEN ? AND ?
       GROUP BY COALESCE(assigned_to, 'Unassigned')`,
      [from, to]
    );

    // Build map: employee -> count
    const countMap = Object.fromEntries(
      byEmployee.map((r) => [r.employee, Number(r.lead_count)])
    );

    // Combine: all reps from lead_distribution + any others from customers (e.g. Unassigned)
    const repSet = new Set(allReps.map((r) => r.username));
    byEmployee.forEach((r) => repSet.add(r.employee));

    const byEmployeeFull = [...repSet]
      .map((emp) => ({
        employee: emp,
        leadCount: countMap[emp] ?? 0,
      }))
      .sort((a, b) => b.leadCount - a.leadCount);

    // Total leads in date range
    const [totalResult] = await conn.execute(
      `SELECT COUNT(*) as total FROM customers WHERE DATE(date_created) BETWEEN ? AND ?`,
      [from, to]
    );

    const total = totalResult[0]?.total ?? 0;

    return NextResponse.json({
      success: true,
      from,
      to,
      total,
      byEmployee: byEmployeeFull,
    });
  } catch (err) {
    console.error("/api/meta-backfill/leads-report error:", err);
    return NextResponse.json(
      { error: "Failed to fetch leads report" },
      { status: 500 }
    );
  }
}
