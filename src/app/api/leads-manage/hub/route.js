import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import {
  attachHubSourceRows,
  fetchLeadsManageHubDashboard,
} from "@/lib/fetchLeadsManageHubDashboard";

export async function GET(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "month";
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const dashboardBase = searchParams.get("dashboardBase") || "admin-dashboard";

    const dashboard = attachHubSourceRows(
      await fetchLeadsManageHubDashboard({
        username: payload.username,
        userRole: payload.role,
        range,
        from: from || undefined,
        to: to || undefined,
      }),
      dashboardBase,
    );

    return NextResponse.json({ success: true, ...dashboard });
  } catch (error) {
    console.error("[leads-manage/hub]", error);
    return NextResponse.json(
      { success: false, error: error.message || "Server error" },
      { status: 500 },
    );
  }
}