import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  ensureAdminOrderListSchema,
  fetchAdminOrderListAllForStats,
  getAdminOrderListUserRole,
} from "@/lib/adminOrderListFetch";
import { computeAdminOrderStatCardAggregates } from "@/lib/adminOrderListStatCards";
import { normalizeOrderListDateRange } from "@/lib/orderTableDateDefaults";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const createdBy = searchParams.get("createdBy")?.trim() || "";
    const leadCampaign = searchParams.get("leadCampaign")?.trim() || "";
    const approvalStatus = searchParams.get("approvalStatus")?.trim() || "";
    const serviceSupportOnly = searchParams.get("serviceSupport") === "1";

    const range = normalizeOrderListDateRange(dateFrom, dateTo);

    const conn = await getDbConnection();
    await ensureAdminOrderListSchema(conn);
    const userRole = await getAdminOrderListUserRole(
      conn,
      payload.username,
      payload.role,
    );

    const orders = await fetchAdminOrderListAllForStats(conn, {
      username: payload.username,
      userRole,
      serviceSupportOnly,
      search,
      dateFrom: range.dateFrom,
      dateTo: range.dateTo,
      createdBy,
      leadCampaign,
      approvalStatus,
    });

    const stats = computeAdminOrderStatCardAggregates(orders, {
      approvalStatusFilter: approvalStatus,
    });

    return NextResponse.json({
      success: true,
      data: {
        ...stats,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
      },
    });
  } catch (err) {
    console.error("[admin/orders/stats]", err);
    return NextResponse.json(
      { error: "Failed to load order statistics", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
