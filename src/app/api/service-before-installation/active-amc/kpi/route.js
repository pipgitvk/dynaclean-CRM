import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { fetchActiveAmcKpiBreakdown } from "@/lib/serviceBeforeInstallationQueries";
import { getDbConnection } from "@/lib/db";

export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filters = parseSbiFiltersFromSearchParams(searchParams);
    const conn = await getDbConnection();
    const breakdown = await fetchActiveAmcKpiBreakdown(conn, filters);

    return NextResponse.json({
      success: true,
      breakdown,
    });
  } catch (error) {
    console.error("[active-amc/kpi]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}