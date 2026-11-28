import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationHubCounts } from "@/lib/serviceBeforeInstallationQueries";
import { resolveLeadsHubRange } from "@/lib/leadsManageHubRange";
import { SBI_RANGE_SELECT } from "@/lib/serviceBeforeInstallationFilters";

export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const rangeKey = String(searchParams.get("range") || SBI_RANGE_SELECT.id).trim().toLowerCase();

    const baseFilterInput = {
      search: searchParams.get("search"),
      q: searchParams.get("q"),
      model: searchParams.get("model"),
      state: searchParams.get("state"),
      serial: searchParams.get("serial"),
      itemType: searchParams.get("itemType") ?? searchParams.get("item_type"),
      assignedTo: searchParams.get("assignedTo") ?? searchParams.get("assigned_to"),
      serviceStatus: searchParams.get("serviceStatus") ?? searchParams.get("service_status"),
    };

    if (rangeKey === SBI_RANGE_SELECT.id || rangeKey === "all") {
      const filters = parseSbiFilters(baseFilterInput);
      const counts = await fetchServiceBeforeInstallationHubCounts(filters, {
        viewerRole: auth.payload?.role,
      });
      return NextResponse.json({
        success: true,
        counts,
        prevCounts: {},
        range: rangeKey,
        rangeLabel: rangeKey === SBI_RANGE_SELECT.id ? SBI_RANGE_SELECT.label : "All time",
        from: "",
        to: "",
        filters,
      });
    }

    const resolved = resolveLeadsHubRange(rangeKey, {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const filters = parseSbiFilters({
      ...baseFilterInput,
      from: resolved.from,
      to: resolved.to,
    });

    const prevFilters = parseSbiFilters({
      ...filters,
      from: resolved.prevFrom,
      to: resolved.prevTo,
    });

    const hubCountOpts = { viewerRole: auth.payload?.role };
    const [counts, prevCounts] = await Promise.all([
      fetchServiceBeforeInstallationHubCounts(filters, hubCountOpts),
      fetchServiceBeforeInstallationHubCounts(prevFilters, hubCountOpts),
    ]);

    return NextResponse.json({
      success: true,
      counts,
      prevCounts,
      range: resolved.rangeKey,
      rangeLabel: resolved.rangeLabel,
      from: resolved.from,
      to: resolved.to,
      filters,
    });
  } catch (error) {
    console.error("[service-before-installation/hub]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}