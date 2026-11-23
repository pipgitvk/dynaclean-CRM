import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationSegmentPage } from "@/lib/serviceBeforeInstallationQueries";
import {
  OPEN_COMPLETIONS_TABLE_API_SLUGS,
  openCompletionsBucketFromApiSlug,
} from "@/lib/serviceBeforeInstallationHub";

const ALLOWED = new Set(OPEN_COMPLETIONS_TABLE_API_SLUGS);

/**
 * Table rows for one Open Complaints KPI card.
 * GET /api/service-before-installation/open-completions/list/pending
 */
export async function GET(request, context) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const params = await context.params;
    const slug = String(params?.bucket || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED.has(slug)) {
      return NextResponse.json({ success: false, error: "Unknown table card" }, { status: 400 });
    }

    const filterBucket = openCompletionsBucketFromApiSlug(slug);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;
    const filters = {
      ...parseSbiFiltersFromSearchParams(searchParams),
      openCompletionsBucket: filterBucket,
      serviceStatus: "",
    };

    const result = await fetchServiceBeforeInstallationSegmentPage("open-completions", {
      ...filters,
      limit,
      skip,
      skipTotal: true,
    });

    const data = result.data || [];
    return NextResponse.json({
      success: true,
      bucket: filterBucket,
      data,
      pagination: {
        total: null,
        limit,
        skip,
        hasMore: result.hasMore ?? data.length >= limit,
        totalPending: true,
      },
    });
  } catch (error) {
    console.error("[open-completions/list/bucket]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}