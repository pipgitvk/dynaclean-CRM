import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  fetchServiceBeforeInstallationSegmentPage,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";

/**
 * Table rows only — no KPI breakdown, no full COUNT.
 * Cards: GET /open-installation/kpi
 * Total: GET /open-installation/count
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;
    const filters = withDefaultOpenInstallationItemType(
      parseSbiFiltersFromSearchParams(searchParams),
    );
    const deferServiceEnrich =
      String(searchParams.get("deferServiceEnrich") || "1").trim() !== "0";

    // Raw neworder page only — dispatch/service columns via /services-enrich after paint.
    const result = await fetchServiceBeforeInstallationSegmentPage("open-installation", {
      ...filters,
      limit,
      skip,
      includeOpenInstallationBreakdown: false,
      skipTotal: true,
      deferServiceEnrich,
    });

    const data = result.data || [];
    const hasMore =
      result.hasMore ?? data.length >= limit;

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        total: null,
        limit,
        skip,
        hasMore,
        totalPending: true,
      },
    });
  } catch (error) {
    console.error("[open-installation/list]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
