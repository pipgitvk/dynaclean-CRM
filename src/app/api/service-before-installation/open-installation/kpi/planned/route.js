import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationKpiBucket,
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
    const { count } = await countOpenInstallationKpiBucket(filters, "planned");

    return NextResponse.json({
      success: true,
      installation_planned: count,
      field: "installation_planned",
      count,
    });
  } catch (error) {
    console.error("[open-installation/kpi/planned]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}