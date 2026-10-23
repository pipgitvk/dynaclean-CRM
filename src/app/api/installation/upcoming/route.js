// /app/api/installations/upcoming/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { buildUpcomingInstallationsQuery } from "@/lib/upcomingInstallationsQuery";
import { syncInstallationOrderStatusMarkOnly } from "@/lib/syncInstalledOrdersFromServiceReports";

/**
 * API route for upcoming installations.
 * Query parameters:
 *   ?type=products|spares|all
 *   ?registration=unregistered
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const registration = searchParams.get("registration");
    const type =
      registration === "unregistered"
        ? "products"
        : searchParams.get("type") || "products";

    const query = buildUpcomingInstallationsQuery({ type, registration });

    const pool = await getDbConnection();

    const [rows] = await pool.query(query);

    syncInstallationOrderStatusMarkOnly(pool).catch((syncErr) => {
      console.error("Upcoming installations background sync:", syncErr?.message || syncErr);
    });

    return NextResponse.json({
      installations: rows,
      total: rows.length,
      totalPages: 1,
      currentPage: 1,
      pageSize: rows.length,
    });
  } catch (error) {
    console.error("Error fetching upcoming installations:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch upcoming installations",
        error: error.message,
      },
      { status: 500 },
    );
  }
}
