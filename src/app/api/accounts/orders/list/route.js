import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  ensureAccountsOrderListSchema,
  fetchAccountsOrderListPage,
  getAccountsOrderListUserRole,
} from "@/lib/accountsOrderListFetch";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Math.min(Number(searchParams.get("limit")) || 10000, 100000);
    const search = searchParams.get("search")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const createdBy = searchParams.get("createdBy")?.trim() || "";
    const paymentTerms = searchParams.get("paymentTerms")?.trim() || "";

    const conn = await getDbConnection();
    await ensureAccountsOrderListSchema(conn);
    const userRole = await getAccountsOrderListUserRole(conn, payload.username);

    const result = await fetchAccountsOrderListPage(conn, {
      username: payload.username,
      userRole,
      page,
      limit,
      search,
      dateFrom,
      dateTo,
      createdBy,
      paymentTerms,
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
    console.error("[accounts/orders/list]", err);
    return NextResponse.json(
      { error: "Failed to load orders", detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
