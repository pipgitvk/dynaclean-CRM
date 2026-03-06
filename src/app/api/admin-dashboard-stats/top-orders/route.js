// GET /api/admin-dashboard-stats/top-orders?timeRange=thisMonth
// Returns top 5 products by quantity sold (jyada bika) in the given time range
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
      `SELECT 
        qi.item_code,
        MAX(qi.item_name) AS item_name,
        SUM(COALESCE(qi.quantity, 0)) AS total_quantity,
        SUM(COALESCE(qi.total_price, 0)) AS total_sales
       FROM neworder no
       JOIN quotation_items qi ON no.quote_number = qi.quote_number
       WHERE DATE(no.created_at) >= ? AND DATE(no.created_at) <= ?
       GROUP BY qi.item_code
       ORDER BY total_quantity DESC
       LIMIT 5`,
      [startDateStr, endDateStr]
    );

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        item_code: r.item_code,
        item_name: r.item_name,
        total_quantity: Number(r.total_quantity) || 0,
        total_sales: r.total_sales,
      })),
    });
  } catch (error) {
    console.error("Top products API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch top products" },
      { status: 500 }
    );
  }
}
