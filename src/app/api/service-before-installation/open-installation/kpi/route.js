import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  fetchOpenInstallationCardsBreakdown,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";

/**
 * Fast 3-card KPI (one neworder scan). Planned + Google Feedback stay on their own APIs.
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filters = withDefaultOpenInstallationItemType(
      parseSbiFiltersFromSearchParams(searchParams),
    );
    const { openInstallationBucket: _b, ...kpiFilters } = filters;

    const breakdown = await fetchOpenInstallationCardsBreakdown(kpiFilters);

    return NextResponse.json({
      success: true,
      openInstallationBreakdown: breakdown,
    });
  } catch (error) {
    console.error("[open-installation/kpi]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
