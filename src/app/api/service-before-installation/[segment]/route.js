import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationSegmentPage } from "@/lib/serviceBeforeInstallationQueries";

export async function GET(request, { params }) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const segment = (await params)?.segment;
    if (!isServiceBeforeInstallationSegment(segment)) {
      return NextResponse.json({ success: false, error: "Invalid segment" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const skip = parseInt(searchParams.get("skip") || "0", 10) || 0;
    const filters = parseSbiFilters({
      search: searchParams.get("search"),
      q: searchParams.get("q"),
      model: searchParams.get("model"),
      state: searchParams.get("state"),
      serial: searchParams.get("serial"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      itemType: searchParams.get("itemType") ?? searchParams.get("item_type"),
    });

    const result = await fetchServiceBeforeInstallationSegmentPage(segment, {
      ...filters,
      limit,
      skip,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        limit,
        skip,
        hasMore: skip + result.data.length < result.total,
      },
    });
  } catch (error) {
    console.error("[service-before-installation/segment]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}