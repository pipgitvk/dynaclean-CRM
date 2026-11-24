import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import {
  forceOpenInstallationProductsOnly,
  parseSbiFiltersFromSearchParams,
} from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationGoogleFeedbackCollected,
  fetchOpenInstallationGoogleFeedbackCollectedPage,
} from "@/lib/openInstallationGoogleFeedbackCardQueries";

/**
 * Dedicated Open Installation — Google Feedback Collected card.
 *
 * GET /api/service-before-installation/open-installation/google-feedback?countOnly=1
 * GET /api/service-before-installation/open-installation/google-feedback?limit=&skip=
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filters = forceOpenInstallationProductsOnly(
      parseSbiFiltersFromSearchParams(searchParams),
    );
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = Math.max(parseInt(searchParams.get("skip") || "0", 10) || 0, 0);
    const countOnly = String(searchParams.get("countOnly") || "").trim() === "1";
    const skipTotal = String(searchParams.get("skipTotal") || "1").trim() !== "0";
    const skipServiceEnrich =
      String(searchParams.get("deferServiceEnrich") || "0").trim() === "1";

    if (countOnly) {
      const total = await countOpenInstallationGoogleFeedbackCollected(filters);
      return NextResponse.json({
        success: true,
        data: [],
        bucket: "feedback_collected",
        field: "feedback_collected",
        count: total,
        feedback_collected: total,
        pagination: { total, limit, skip, hasMore: skip + limit < total },
      });
    }

    const page = await fetchOpenInstallationGoogleFeedbackCollectedPage(
      filters,
      limit,
      skip,
      { skipTotal, skipServiceEnrich },
    );
    const data = page.data || [];
    const total = page.total != null ? page.total : null;

    return NextResponse.json({
      success: true,
      data,
      bucket: "feedback_collected",
      field: "feedback_collected",
      count: total,
      feedback_collected: total,
      pagination: {
        total,
        limit,
        skip,
        hasMore: Boolean(page.hasMore) || data.length >= limit,
        totalPending: total == null,
      },
    });
  } catch (error) {
    console.error("[open-installation/google-feedback]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}