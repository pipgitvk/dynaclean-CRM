import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import {
  fetchOpenInstallationBucketList,
  withDefaultOpenInstallationItemType,
} from "@/lib/serviceBeforeInstallationQueries";
import { fetchOpenInstallationGoogleFeedbackCollectedPage } from "@/lib/openInstallationGoogleFeedbackCardQueries";
import {
  OPEN_INSTALLATION_TABLE_API_SLUGS,
  openInstallationBucketFromApiSlug,
} from "@/lib/serviceBeforeInstallationHub";

const ALLOWED = new Set(OPEN_INSTALLATION_TABLE_API_SLUGS);

/**
 * Table rows for one Open Installation card.
 * GET /api/service-before-installation/open-installation/list/delivered-pending
 * GET .../delivery-pending | /planned | /completed | /feedback-collected
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

    const filterBucket = openInstallationBucketFromApiSlug(slug);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;
    const deferServiceEnrich =
      String(searchParams.get("deferServiceEnrich") || "1").trim() !== "0";
    const filters = withDefaultOpenInstallationItemType({
      ...parseSbiFiltersFromSearchParams(searchParams),
      openInstallationBucket: filterBucket,
    });

    if (filterBucket === "feedback_collected") {
      const page = await fetchOpenInstallationGoogleFeedbackCollectedPage(
        filters,
        limit,
        skip,
        { skipTotal: true, skipServiceEnrich: deferServiceEnrich },
      );
      const data = page.data || [];
      return NextResponse.json({
        success: true,
        bucket: filterBucket,
        data,
        pagination: {
          total: page.total ?? null,
          limit,
          skip,
          hasMore: Boolean(page.hasMore) || data.length >= limit,
          totalPending: page.total == null,
        },
      });
    }

    const page = await fetchOpenInstallationBucketList(filters, limit, skip, {
      deferServiceEnrich,
    });
    const data = page.data || [];
    return NextResponse.json({
      success: true,
      bucket: filterBucket,
      data,
      pagination: {
        total: page.total ?? null,
        limit,
        skip,
        hasMore: Boolean(page.hasMore) || data.length >= limit,
        totalPending: true,
      },
    });
  } catch (error) {
    console.error("[open-installation/list/bucket]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
