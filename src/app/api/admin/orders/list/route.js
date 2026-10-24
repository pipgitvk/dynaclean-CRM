import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  ensureAdminOrderListSchema,
  fetchAdminOrderListPage,
  getAdminOrderListUserRole,
} from "@/lib/adminOrderListFetch";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Math.min(Number(searchParams.get("limit")) || 40, 100);
    const search = searchParams.get("search")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const createdBy = searchParams.get("createdBy")?.trim() || "";
    const leadCampaign = searchParams.get("leadCampaign")?.trim() || "";
    const approvalStatus = searchParams.get("approvalStatus")?.trim() || "";
    const serviceSupportOnly = searchParams.get("serviceSupport") === "1";

    const conn = await getDbConnection();
    await ensureAdminOrderListSchema(conn);
    const userRole = await getAdminOrderListUserRole(conn, payload.username);

    const result = await fetchAdminOrderListPage(conn, {
      username: payload.username,
      userRole,
      serviceSupportOnly,
      page,
      limit,
      search,
      dateFrom,
      dateTo,
      createdBy,
      leadCampaign,
      approvalStatus,
    });

    return NextResponse.json({
      success: true,
      data: result.orders,
      meta: {
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
      },
      userRole,
    });
  } catch (err) {
    console.error("[admin/orders/list]", err);
    return NextResponse.json(
      { error: "Failed to load orders", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
