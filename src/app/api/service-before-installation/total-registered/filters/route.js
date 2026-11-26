import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { fetchTotalRegisteredFilterOptions } from "@/lib/serviceBeforeInstallationQueries";

/**
 * Total Registered filter dropdowns only.
 * Reads small master tables — does not scan warranty_products.
 *
 * GET /api/service-before-installation/total-registered/filters
 */
export async function GET() {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const filterOptions = await fetchTotalRegisteredFilterOptions();

    return NextResponse.json({
      success: true,
      segment: "total-registered",
      filterOptions: filterOptions || {
        salesPersons: [],
        serviceEngineers: [],
        thirdPartyEngineers: [],
      },
    });
  } catch (error) {
    console.error("[service-before-installation/total-registered/filters]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
