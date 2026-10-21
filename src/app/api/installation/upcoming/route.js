// /app/api/installations/upcoming/route.js
import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { buildUpcomingInstallationsQuery } from "@/lib/upcomingInstallationsQuery";
import { syncInstalledOrdersFromCompletedInstallationReports } from "@/lib/syncInstalledOrdersFromServiceReports";

/**
 * API route for upcoming installations.
 * Query parameters:
 *   ?type=products|spares|all
 *   ?registration=unregistered
 *   ?sync=1  optional: run auto-installed sync (slow; off by default)
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const registration = searchParams.get("registration");
    const runSync = searchParams.get("sync") === "1";
    const type =
      registration === "unregistered"
        ? "products"
        : searchParams.get("type") || "products";

    const query = buildUpcomingInstallationsQuery({ type, registration });

    const pool = await getDbConnection();

    if (runSync) {
      try {
        await syncInstalledOrdersFromCompletedInstallationReports(pool);
      } catch (syncErr) {
        console.error("Upcoming installations sync skipped:", syncErr?.message || syncErr);
      }
    }

    const [rows] = await pool.query(query);

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
