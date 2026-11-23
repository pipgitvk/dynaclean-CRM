import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { countOpenCompletionsComplaintSegment } from "@/lib/serviceBeforeInstallationQueries";
import {
  OPEN_COMPLETIONS_TABLE_API_SLUGS,
  openCompletionsBucketFromApiSlug,
} from "@/lib/serviceBeforeInstallationHub";

const ALLOWED = new Set(OPEN_COMPLETIONS_TABLE_API_SLUGS);

/**
 * Table total for one Open Complaints KPI card.
 * GET /api/service-before-installation/open-completions/count/pending
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
    const filters = {
      ...parseSbiFiltersFromSearchParams(searchParams),
      openCompletionsBucket: filterBucket,
      serviceStatus: "",
    };
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;

    const total = await countOpenCompletionsComplaintSegment(filters);

    return NextResponse.json({
      success: true,
      bucket: filterBucket,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error("[open-completions/count/bucket]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}