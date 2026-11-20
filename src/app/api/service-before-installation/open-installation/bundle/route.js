import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsEngineerAssignedByColumn } from "@/lib/ensureServiceRecordsEngineerAssignedByColumn";
import { fetchOpenInstallationPageBundle } from "@/lib/serviceBeforeInstallationQueries";

/**
 * Fast Open Installation load: rows + filtered total + KPI cards in one HTTP call.
 *
 * GET /api/service-before-installation/open-installation/bundle?limit=10&skip=0&...
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = Math.max(parseInt(searchParams.get("skip") || "0", 10) || 0, 0);
    const filters = parseSbiFiltersFromSearchParams(searchParams);
    const overdueDelayedOnly =
      String(searchParams.get("overdueDelayedOnly") || searchParams.get("overdue") || "")
        .trim() === "1";

    const conn = await getDbConnection();
    await ensureServiceRecordsEngineerAssignedByColumn(conn);

    const result = await fetchOpenInstallationPageBundle(filters, limit, skip, {
      overdueDelayedOnly,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      openInstallationBreakdown: result.openInstallationBreakdown ?? null,
      pagination: {
        total: result.total,
        limit,
        skip,
        hasMore: Boolean(result.hasMore),
      },
    });
  } catch (error) {
    console.error("[open-installation/bundle]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}