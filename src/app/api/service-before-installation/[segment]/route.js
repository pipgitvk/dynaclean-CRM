import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import { getDbConnection } from "@/lib/db";
import {
  countWarrantyProductsSegment,
  fetchServiceBeforeInstallationSegmentPage,
  fetchServiceBeforeInstallationWpFilterOptions,
} from "@/lib/serviceBeforeInstallationQueries";

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
      assignedTo: searchParams.get("assignedTo") ?? searchParams.get("assigned_to"),
      serviceStatus: searchParams.get("serviceStatus") ?? searchParams.get("service_status"),
      salesPerson: searchParams.get("salesPerson") ?? searchParams.get("sales_person"),
      serviceEngineer: searchParams.get("serviceEngineer") ?? searchParams.get("service_engineer"),
      thirdPartyEngineer:
        searchParams.get("thirdPartyEngineer") ?? searchParams.get("third_party_engineer"),
      registeredInstallation:
        searchParams.get("registeredInstallation") ?? searchParams.get("registered_installation"),
    });

    const filterOptionsOnly =
      String(searchParams.get("filterOptionsOnly") || "").trim() === "1";
    // Default off — full distinct filter-option scans were saturating the DB pool.
    const includeFilterOptions =
      !filterOptionsOnly && String(searchParams.get("includeFilterOptions") || "0").trim() === "1";

    if (filterOptionsOnly) {
      const filterOptions = await fetchServiceBeforeInstallationWpFilterOptions(segment, filters);
      return NextResponse.json({
        success: true,
        data: [],
        filterOptions,
        pagination: { total: 0, limit, skip: 0, hasMore: false },
      });
    }

    const countOnly = String(searchParams.get("countOnly") || "").trim() === "1";
    // Default off — full COUNT on ~1k warranty rows is fast; defer showed "10+" only.
    const deferTotal = String(searchParams.get("deferTotal") || "0").trim() === "1";

    if (countOnly) {
      const conn = await getDbConnection();
      const total = await countWarrantyProductsSegment(conn, segment, filters);
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total, limit, skip, hasMore: false },
      });
    }

    const wantFilterOptions = includeFilterOptions && skip === 0;

    const [result, filterOptions] = await Promise.all([
      fetchServiceBeforeInstallationSegmentPage(segment, {
        ...filters,
        limit,
        skip,
        deferTotal:
          deferTotal &&
          (segment === "total-registered" ||
            segment === "active-warranty" ||
            segment === "due-warranty-expiry"),
      }),
      wantFilterOptions
        ? fetchServiceBeforeInstallationWpFilterOptions(segment, filters)
        : Promise.resolve(null),
    ]);

    const total = result.total;
    const hasMore =
      result.hasMore ??
      (total != null ? skip + result.data.length < total : result.data.length >= limit);

    return NextResponse.json({
      success: true,
      data: result.data,
      filterOptions,
      installationBreakdown: result.installationBreakdown ?? null,
      pagination: {
        total,
        limit,
        skip,
        hasMore,
        totalPending: false,
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