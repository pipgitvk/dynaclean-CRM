import { NextResponse } from "next/server";
import { assertSuperAdminApiAccess } from "@/lib/serviceBeforeInstallationAccess";
import { parseSbiFilters } from "@/lib/serviceBeforeInstallationFilters";
import { fetchServiceBeforeInstallationHubCounts } from "@/lib/serviceBeforeInstallationQueries";

export async function GET(request) {
  try {
    const auth = await assertSuperAdminApiAccess();
    if (!auth.ok) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
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
    });

    const counts = await fetchServiceBeforeInstallationHubCounts(filters);
    return NextResponse.json({ success: true, counts, filters });
  } catch (error) {
    console.error("[service-before-installation/hub]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}