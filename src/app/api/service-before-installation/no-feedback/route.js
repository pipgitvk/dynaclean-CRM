import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import {
  countOpenInstallationNoFeedback,
  fetchOpenInstallationNoFeedbackPage,
} from "@/lib/openInstallationNoFeedbackQueries";

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
 * Dedicated No Feedback (missing installation report) API.
 *
 * GET ?countOnly=1 → total for KPI card (may be slower; call in background)
 * GET ?limit=&skip=&skipTotal=1 → fast list (default), same speed class as other cards
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
    // Default true — list must not wait on full COUNT.
    const skipTotal = String(searchParams.get("skipTotal") || "1").trim() !== "0";

    if (countOnly) {
      const total = await countOpenInstallationNoFeedback(filters);
      return NextResponse.json({
        success: true,
        data: [],
        no_feedback_collected: total,
        pagination: { total, limit, skip, hasMore: skip + limit < total },
      });
    }

    const page = await fetchOpenInstallationNoFeedbackPage(filters, limit, skip, {
      skipTotal,
    });
    const total = page.total != null ? page.total : null;

    return NextResponse.json({
      success: true,
      data: page.data || [],
      no_feedback_collected: total,
      pagination: {
        total,
        limit,
        skip,
        hasMore: Boolean(page.hasMore),
      },
    });
  } catch (error) {
    console.error("[service-before-installation/no-feedback]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}
