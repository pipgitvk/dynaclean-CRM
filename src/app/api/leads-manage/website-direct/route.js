import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  fetchWebsiteDirectLeadsPage,
  normalizeWebsiteDirectLeadFilters,
} from "@/lib/websiteDirectLeadsManage";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get("from") || searchParams.get("startDate") || "";
    const endDate = searchParams.get("to") || searchParams.get("endDate") || "";
    const assignedTo = searchParams.get("assignedTo") || "";
    const leadSource = searchParams.get("leadSource") || searchParams.get("lead_source") || "";
    const outcomeTag =
      searchParams.get("outcomeTag") ||
      searchParams.get("tagStatus") ||
      searchParams.get("statusTag") ||
      "all";
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;
    const includeOptions =
      skip === 0 &&
      searchParams.get("includeOptions") !== "0" &&
      searchParams.get("includeOptions") !== "false";
    const includeSummary =
      skip === 0 &&
      searchParams.get("includeSummary") !== "0" &&
      searchParams.get("includeSummary") !== "false";
    const optionsOnly =
      searchParams.get("optionsOnly") === "1" ||
      searchParams.get("optionsOnly") === "true";

    const filters = normalizeWebsiteDirectLeadFilters({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      assignedTo: assignedTo || undefined,
      leadSource: leadSource || undefined,
      outcomeTag,
      search: search || undefined,
      limit,
      skip,
    });

    const access = {
      username: payload.username,
      userRole: payload.role,
    };

    const result = await fetchWebsiteDirectLeadsPage(filters, access, {
      includeOptions,
      includeSummary,
      optionsOnly,
    });

    return NextResponse.json({
      success: true,
      summary: result.summary,
      filterOptions: result.filterOptions,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("[leads-manage/website-direct]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}