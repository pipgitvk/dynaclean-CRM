import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  ensureAdminOrderListSchema,
  fetchAdminOrderListAllForStats,
  getAdminOrderListUserRole,
} from "@/lib/adminOrderListFetch";
import {
  computeAdminOrderProductSpareTotals,
  loadAdminOrderListCatalogMaps,
} from "@/lib/adminOrderProductSpareTotals";
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
    const itemLineType = searchParams.get("itemLineType")?.trim() || "";
    const serviceSupportOnly = searchParams.get("serviceSupport") === "1";

    const range = normalizeOrderListDateRange(dateFrom, dateTo);

    const conn = await getDbConnection();
    await ensureAdminOrderListSchema(conn);
    const userRole = await getAdminOrderListUserRole(
      conn,
      payload.username,
      payload.role,
    );

    const [{ catalogByCode, spareCatalogByCode }, orders] = await Promise.all([
      loadAdminOrderListCatalogMaps(conn),
      fetchAdminOrderListAllForStats(conn, {
        username: payload.username,
        userRole,
        serviceSupportOnly,
        search,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        createdBy,
        leadCampaign,
        approvalStatus: "",
      }),
    ]);

    const totals = computeAdminOrderProductSpareTotals(
      orders,
      catalogByCode,
      spareCatalogByCode,
      { itemLineTypeFilter: itemLineType },
    );

    return NextResponse.json({
      success: true,
      data: {
        ...totals,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        orderCount: orders.length,
      },
    });
  } catch (err) {
    console.error("[admin/orders/product-spare-totals]", err);
    return NextResponse.json(
      {
        error: "Failed to load product/spare totals",
        detail: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}