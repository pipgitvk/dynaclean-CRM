import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationPlannedKpi,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";

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
    const installation_planned = await countOpenInstallationPlannedKpi(filters);

    return NextResponse.json({
      success: true,
      installation_planned,
    });
  } catch (error) {
    console.error("[open-installation/kpi/planned]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}