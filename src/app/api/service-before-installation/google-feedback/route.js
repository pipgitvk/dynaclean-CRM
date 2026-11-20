import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationGoogleFeedbackStats,
  fetchOpenInstallationGoogleFeedbackPage,
} from "@/lib/openInstallationGoogleFeedbackQueries";

function parseFiltersFromSearchParams(searchParams) {
  return parseSbiFilters({
    search: searchParams.get("search"),
    q: searchParams.get("q"),
    model: searchParams.get("model"),
    state: searchParams.get("state"),
    serial: searchParams.get("serial"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    itemType: searchParams.get("itemType") ?? searchParams.get("item_type"),
    salesPerson: searchParams.get("salesPerson") ?? searchParams.get("sales_person"),
    assignedBy: searchParams.get("assignedBy") ?? searchParams.get("assigned_by"),
  });
}

/**
 * Open Installation — Google feedback collected (installed, google_feedback_collected = yes).
 */
export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const filters = parseFiltersFromSearchParams(searchParams);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = Math.max(parseInt(searchParams.get("skip") || "0", 10) || 0, 0);
    const countOnly = String(searchParams.get("countOnly") || "").trim() === "1";
    const skipTotal = String(searchParams.get("skipTotal") || "1").trim() !== "0";

    if (countOnly) {
      const stats = await countOpenInstallationGoogleFeedbackStats(filters);
      const total = stats.feedback_collected;
      return NextResponse.json({
        success: true,
        data: [],
        feedback_collected: total,
        pagination: { total, limit, skip, hasMore: skip + limit < total },
      });
    }

    const page = await fetchOpenInstallationGoogleFeedbackPage(
      filters,
      "feedback_collected",
      limit,
      skip,
      { skipTotal },
    );
    const total = page.total != null ? page.total : null;

    return NextResponse.json({
      success: true,
      data: page.data || [],
      feedback_collected: total,
      pagination: {
        total,
        limit,
        skip,
        hasMore: Boolean(page.hasMore),
      },
    });
  } catch (error) {
    console.error("[service-before-installation/google-feedback]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}