import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationHubCounts } from "@/lib/serviceBeforeInstallationQueries";
import { resolveLeadsHubRange } from "@/lib/leadsManageHubRange";

export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const rangeKey = searchParams.get("range") || "month";
    const resolved = resolveLeadsHubRange(rangeKey, {
      from: searchParams.get("from"),
      to: searchParams.get("to"),
    });

    const filters = parseSbiFilters({
      search: searchParams.get("search"),
      q: searchParams.get("q"),
      model: searchParams.get("model"),
      state: searchParams.get("state"),
      serial: searchParams.get("serial"),
      from: resolved.from,
      to: resolved.to,
      itemType: searchParams.get("itemType") ?? searchParams.get("item_type"),
      assignedTo: searchParams.get("assignedTo") ?? searchParams.get("assigned_to"),
      serviceStatus: searchParams.get("serviceStatus") ?? searchParams.get("service_status"),
    });

    const prevFilters = parseSbiFilters({
      ...filters,
      from: resolved.prevFrom,
      to: resolved.prevTo,
    });

    const [counts, prevCounts] = await Promise.all([
      fetchServiceBeforeInstallationHubCounts(filters),
      fetchServiceBeforeInstallationHubCounts(prevFilters),
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