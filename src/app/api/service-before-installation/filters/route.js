import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationSegmentFilterOptions } from "@/lib/serviceBeforeInstallationQueries";

/**
 * Dedicated filter-options API (dropdown names).
 * Kept separate from list/KPI routes so heavy distinct scans never block row loads.
 *
 * GET /api/service-before-installation/filters?segment=open-installation&from=&to=...
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const segment = String(searchParams.get("segment") || "").trim();
    if (!isServiceBeforeInstallationSegment(segment)) {
      return NextResponse.json({ success: false, error: "Invalid segment" }, { status: 400 });
    }

    const filters = parseSbiFiltersFromSearchParams(searchParams);
    const filterOptions = await fetchServiceBeforeInstallationSegmentFilterOptions(
      segment,
      filters,
    );

    return NextResponse.json({
      success: true,
      segment,
      filterOptions: filterOptions || {
        salesPersons: [],
        serviceEngineers: [],
        thirdPartyEngineers: [],
        instCompletedBys: [],
        assignedBys: [],
        registeredBys: [],
      },
    });
  } catch (error) {
    console.error("[service-before-installation/filters]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
