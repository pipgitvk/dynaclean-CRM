import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { isServiceBeforeInstallationSegment } from "@/lib/serviceBeforeInstallationHub";
import { parseSbiFiltersFromSearchParams } from "@/lib/serviceBeforeInstallationFilters";
import { getDbConnection } from "@/lib/db";
import { ensureServiceRecordsEngineerAssignedByColumn } from "@/lib/ensureServiceRecordsEngineerAssignedByColumn";
import {
  countOpenInstallationSegment,
  countWarrantyProductsSegment,
  fetchServiceBeforeInstallationSegmentPage,
  fetchServiceBeforeInstallationSegmentFilterOptions,
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
    const filters = parseSbiFiltersFromSearchParams(searchParams);

    // Prefer /api/service-before-installation/filters — kept for backwards compatibility.
    const filterOptionsOnly =
      String(searchParams.get("filterOptionsOnly") || "").trim() === "1";
    // Default off — full distinct filter-option scans were saturating the DB pool.
    const includeFilterOptions =
      !filterOptionsOnly && String(searchParams.get("includeFilterOptions") || "0").trim() === "1";

    if (filterOptionsOnly) {
      const filterOptions = await fetchServiceBeforeInstallationSegmentFilterOptions(
        segment,
        filters,
      );
      return NextResponse.json({
        success: true,
        data: [],
        filterOptions,
        pagination: { total: 0, limit, skip: 0, hasMore: false },
      });
    }

    const countOnly = String(searchParams.get("countOnly") || "").trim() === "1";
    const breakdownOnly = String(searchParams.get("breakdownOnly") || "").trim() === "1";
    const includeOpenInstallationBreakdown =
      String(searchParams.get("includeOpenInstallationBreakdown") || "1").trim() !== "0";
    // Default off — full COUNT on ~1k warranty rows is fast; defer showed "10+" only.
    const deferTotal = String(searchParams.get("deferTotal") || "0").trim() === "1";
    const skipTotal = String(searchParams.get("skipTotal") || "0").trim() === "1";
    const deferServiceEnrich =
      segment === "open-installation" || segment === "overdue-delayed-installation"
        ? String(searchParams.get("deferServiceEnrich") || "1").trim() !== "0"
        : false;

    const needsServiceRecordsSchema =
      (segment === "open-installation" || segment === "overdue-delayed-installation") &&
      !countOnly &&
      !breakdownOnly &&
      !deferServiceEnrich;
    if (needsServiceRecordsSchema) {
      const conn = await getDbConnection();
      await ensureServiceRecordsEngineerAssignedByColumn(conn);
    }

    if (countOnly) {
      let total = 0;
      if (segment === "open-installation" || segment === "overdue-delayed-installation") {
        total = await countOpenInstallationSegment(segment, filters);
      } else {
        const conn = await getDbConnection();
        total = await countWarrantyProductsSegment(conn, segment, filters);
      }
      return NextResponse.json({
        success: true,
        data: [],
        pagination: { total, limit, skip, hasMore: skip + limit < total },
      });
    }

    const wantFilterOptions = includeFilterOptions && skip === 0;

    const [result, filterOptions] = await Promise.all([
      fetchServiceBeforeInstallationSegmentPage(segment, {
        ...filters,
        limit,
        skip,
        breakdownOnly: breakdownOnly && segment === "open-installation",
        includeOpenInstallationBreakdown,
        deferTotal:
          deferTotal &&
          (segment === "total-registered" ||
            segment === "active-warranty" ||
            segment === "due-warranty-expiry"),
        skipTotal,
        deferServiceEnrich,
      }),
      wantFilterOptions
        ? fetchServiceBeforeInstallationSegmentFilterOptions(segment, filters)
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
      openInstallationBreakdown: result.openInstallationBreakdown ?? null,
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