import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationSegment,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";

/**
 * Active-bucket table total only (pagination).
 * Cards: /kpi — List: /list
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;

    const total = await countOpenInstallationSegment("open-installation", filters);

    return NextResponse.json({
      success: true,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error("[open-installation/count]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
