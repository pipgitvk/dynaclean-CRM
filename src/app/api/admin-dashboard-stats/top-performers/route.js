import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  fetchTopSalesPerformersWithProductSpare,
  parseAdminDashboardStatsDateRange,
} from "@/lib/adminDashboardTopPerformers";

export async function GET(req) {
  try {
    const session = await getSessionPayload();
    const role = session?.role || null;
    const privilegedRoles = ["ADMIN", "SUPERADMIN"];
    if (!privilegedRoles.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("timeRange") || "thisMonth";
    const customDateFrom = searchParams.get("dateFrom");
    const customDateTo = searchParams.get("dateTo");

    const { startDateStr, endDateStr } = parseAdminDashboardStatsDateRange(
      timeRange,
      customDateFrom,
      customDateTo,
    );

    const conn = await getDbConnection();
    const performers = await fetchTopSalesPerformersWithProductSpare(
      conn,
      startDateStr,
      endDateStr,
    );

    const totals = performers.reduce(
      (acc, p) => {
        acc.products_taxable += Number(p.products_taxable) || 0;
        acc.spares_taxable += Number(p.spares_taxable) || 0;
        return acc;
      },
      { products_taxable: 0, spares_taxable: 0 },
    );

    return NextResponse.json({
      success: true,
      data: performers,
      meta: {
        dateFrom: startDateStr,
        dateTo: endDateStr,
        ...totals,
      },
    });
  } catch (error) {
    console.error("Top performers API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch top performers",
        details: error.message,
      },
      { status: 500 },
    );
  }
}