// GET /api/admin-dashboard-stats/top-orders?timeRange=thisMonth
// Returns top 5 orders by totalamt (sales) for the given time range
import { getDbConnection } from "@/lib/db";
import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";

export async function GET(req) {
  const conn = await getDbConnection();
  const { searchParams } = new URL(req.url);

  try {
    const session = await getSessionPayload();
    const role = session?.role || null;
    const privilegedRoles = ["ADMIN", "SUPERADMIN"];
    if (!privilegedRoles.includes(role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const timeRange = searchParams.get("timeRange") || "thisMonth";
    let startDate, endDate;
    const today = new Date();

    switch (timeRange) {
      case "today": {
        startDate = new Date(today);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);
        break;
      }
      case "thisWeek": {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        startDate = new Date(d.setDate(diff));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        break;
      }
      case "lastMonth":
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "thisMonth":
      default:
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date();
        break;
    }

    const startDateStr = startDate.toISOString().slice(0, 10);
    const endDateStr = endDate.toISOString().slice(0, 10);

    const [rows] = await conn.execute(
      `SELECT order_id, quote_number, client_name, company_name, totalamt, created_at
       FROM neworder
       WHERE DATE(created_at) >= ? AND DATE(created_at) <= ?
       ORDER BY COALESCE(totalamt, 0) DESC
       LIMIT 5`,
      [startDateStr, endDateStr]
    );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        order_id: r.order_id,
        quote_number: r.quote_number,
        client_name: r.client_name,
        company_name: r.company_name,
        totalamt: r.totalamt,
        created_at: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Top orders API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch top orders" },
      { status: 500 }
    );
  }
}
