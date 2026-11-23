import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationKpiBucket,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";

const ALLOWED = new Set([
  "delivered-pending",
  "delivery-pending",
  "completed",
  "planned",
]);

/**
 * Single Open Installation KPI card.
 * GET /api/service-before-installation/open-installation/kpi/delivered-pending
 */
export async function GET(request, context) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const bucket = String(params?.bucket || "").trim().toLowerCase();
    if (!ALLOWED.has(bucket)) {
      return NextResponse.json({ success: false, error: "Unknown KPI card" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const filters = withDefaultOpenInstallationItemType(
      parseSbiFiltersFromSearchParams(searchParams),
    );
    const { field, count } = await countOpenInstallationKpiBucket(filters, bucket);

    return NextResponse.json({
      success: true,
      bucket,
      field,
      count,
      [field]: count,
    });
  } catch (error) {
    console.error("[open-installation/kpi/bucket]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}