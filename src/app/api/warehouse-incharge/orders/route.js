import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { getRepListUserRole } from "@/lib/repListUserRole";
import { isWarehouseInchargeRole } from "@/lib/warehouseInAccess";
import { normalizeRoleKey } from "@/lib/roleKeyUtils";
import {
  dispatchWarehousePendingWhere,
  ORDER_DISPATCH_NOT_COMPLETE_SQL,
  ORDER_NOT_CANCELLED_SQL,
} from "@/lib/warehouseDispatchPendingCount";
import { orderListReportWhereSql } from "@/lib/orderReportVisibility";
import { sqlQuoteTrimEqColumns } from "@/lib/sqlQuoteMatch";
import { fetchOrderDispatchLineOptions } from "@/lib/dispatchPartialSelection";
import { formatMobileLast4 } from "@/lib/formatMobileLast4";

async function assertWarehouseIncharge(payload) {
  if (!payload) return false;
  let role = payload.role ?? payload.userRole;
  if (payload.username) {
    try {
      const repRole = await getRepListUserRole(payload.username);
      if (repRole) role = repRole;
    } catch {
      /* keep JWT */
    }
  }
  return isWarehouseInchargeRole(normalizeRoleKey(role));
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    if (!(await assertWarehouseIncharge(payload))) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    const conn = await getDbConnection();
    const roleKey = "WAREHOUSE INCHARGE";

    if (orderId) {
      const [orderRows] = await conn.execute(
        `SELECT no.order_id, no.created_by, no.created_at, no.contact, no.quote_number,
                qr.company_name, qr.ship_to
         FROM neworder no
         LEFT JOIN quotations_records qr
           ON ${sqlQuoteTrimEqColumns("no.quote_number", "qr.quote_number")}
         WHERE no.order_id = ?
         LIMIT 1`,
        [orderId],
      );
      const order = orderRows?.[0];
      if (!order) {
        return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
      }
      const { lines } = await fetchOrderDispatchLineOptions(conn, orderId);
      return NextResponse.json({
        success: true,
        order: {
          ...order,
          mobile_last4: formatMobileLast4(order.contact),
        },
        lines,
      });
    }

    const reportWhere = orderListReportWhereSql(roleKey);
    const whereD = dispatchWarehousePendingWhere("d");
    let sql = `
      SELECT
        no.order_id,
        no.created_by,
        no.created_at,
        no.contact,
        no.quote_number,
        no.dispatch_status,
        qr.company_name,
        qr.ship_to,
        COUNT(d.id) AS pending_units
      FROM neworder no
      INNER JOIN dispatch d
        ON ${sqlQuoteTrimEqColumns("d.quote_number", "no.quote_number")}
      LEFT JOIN quotations_records qr
        ON ${sqlQuoteTrimEqColumns("no.quote_number", "qr.quote_number")}
      WHERE ${whereD}
        AND ${ORDER_NOT_CANCELLED_SQL}
        AND ${ORDER_DISPATCH_NOT_COMPLETE_SQL}`;

    const params = [];
    if (reportWhere) {
      sql += ` AND ${reportWhere}`;
    }
    sql += `
      GROUP BY no.order_id, no.created_by, no.created_at, no.contact, no.quote_number,
               no.dispatch_status, qr.company_name, qr.ship_to
      ORDER BY no.created_at DESC
      LIMIT 200`;

    const [rows] = await conn.execute(sql, params);
    const orders = (rows || []).map((r) => ({
      order_id: r.order_id,
      created_by: r.created_by,
      created_at: r.created_at,
      company_name: r.company_name || "—",
      mobile_last4: formatMobileLast4(r.contact),
      ship_to: r.ship_to || "—",
      pending_units: Number(r.pending_units) || 0,
      quote_number: r.quote_number,
    }));

    return NextResponse.json({ success: true, orders });
  } catch (err) {
    console.error("warehouse-incharge orders GET:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
