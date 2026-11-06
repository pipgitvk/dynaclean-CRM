import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { ensureNeworderPunchDateColumn } from "@/lib/ensureNeworderPunchDateColumn";
import {
  canEditOrderPoDate,
  orderPoDateToMysqlDateTime,
  parseOrderPoDateInput,
} from "@/lib/orderPoDatePermissions";
import { getAccountsOrderListUserRole } from "@/lib/accountsOrderListFetch";

export async function PATCH(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orderId = String(params?.order_id ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const userRole = await getAccountsOrderListUserRole(
      conn,
      payload.username,
      payload.role,
    );

    if (!canEditOrderPoDate(userRole)) {
      return NextResponse.json(
        { error: "You do not have permission to edit Order Date" },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const parsed = parseOrderPoDateInput(body.order_date ?? body.orderDate);
    if (!parsed) {
      return NextResponse.json(
        { error: "Valid Order Date / PO Date is required (YYYY-MM-DD)" },
        { status: 400 },
      );
    }

    const mysqlDt = orderPoDateToMysqlDateTime(parsed);
    await ensureNeworderPunchDateColumn(conn);

    const [result] = await conn.execute(
      `UPDATE neworder SET created_at = ? WHERE order_id = ?`,
      [mysqlDt, orderId],
    );

    if (!result.affectedRows) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      order_id: orderId,
      order_date: parsed,
    });
  } catch (err) {
    console.error("[orders/po-date PATCH]", err);
    return NextResponse.json(
      { error: err.message || "Failed to update order date" },
      { status: 500 },
    );
  }
}
