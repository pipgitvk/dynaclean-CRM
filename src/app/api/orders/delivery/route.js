import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canEditDeliveryProof } from "@/lib/orderDocumentEditRules";
import { canManageAnyOrderDeliveryRole } from "@/lib/roleKeyUtils";
import {
  dispatchStatusAllowsDeliveryUpdate,
  orderHasDispatchedStockForOrderId,
} from "@/lib/orderDeliveryEligibility";
import {
  DELIVERY_STATUS_FULL,
  DELIVERY_STATUS_PARTIAL,
  resolveDeliveryStatusAfterUpdate,
} from "@/lib/orderDeliveryStatus";
import {
  ensureOrderDeliveryBatchesTable,
  persistOrderDeliveryBatch,
} from "@/lib/orderDeliveryBatches";

export async function POST(request) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !payload.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentUsername = payload.username;
    const body = await request.json();
    const {
      order_id,
      delivered_on,
      delivery_proof,
      delivery_remark,
      update_proof_only,
    } = body;

    if (!order_id) {
      return NextResponse.json({ error: "Order ID is required" }, { status: 400 });
    }

    const conn = await getDbConnection();

    const [orderRows] = await conn.execute(
      `SELECT booking_by, dispatch_status, delivery_status, delivered_on, delivery_proof, delivery_remark
       FROM neworder WHERE order_id = ?`,
      [order_id],
    );

    if (orderRows.length === 0) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderRows[0];

    const [roleRows] = await conn.execute(
      "SELECT userRole FROM rep_list WHERE username = ? LIMIT 1",
      [currentUsername],
    );
    const userRole = roleRows[0]?.userRole || payload.role || "";
    const canManageDelivery =
      order.booking_by === currentUsername ||
      canManageAnyOrderDeliveryRole(userRole);

    if (!canManageDelivery) {
      return NextResponse.json(
        { error: "Only the booking person can update delivery status" },
        { status: 403 },
      );
    }

    const hasDispatchedStock = await orderHasDispatchedStockForOrderId(
      conn,
      order_id,
    );
    if (
      !dispatchStatusAllowsDeliveryUpdate(
        order.dispatch_status,
        hasDispatchedStock,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Delivery can be updated only after at least one item is dispatched",
        },
        { status: 400 },
      );
    }

    const isFullyDelivered = Number(order.delivery_status) === DELIVERY_STATUS_FULL;

    if (isFullyDelivered && update_proof_only) {
      if (!canEditDeliveryProof(order)) {
        return NextResponse.json(
          { error: "Delivery proof can only be edited within 24 hours of delivery." },
          { status: 403 },
        );
      }

      if (!delivery_proof) {
        return NextResponse.json(
          { error: "Delivery proof file is required" },
          { status: 400 },
        );
      }

      await conn.execute(
        "UPDATE neworder SET delivery_proof = ? WHERE order_id = ?",
        [delivery_proof, order_id],
      );

      return NextResponse.json({
        success: true,
        message: "Delivery proof updated successfully",
      });
    }

    if (isFullyDelivered) {
      return NextResponse.json(
        { error: "Delivery is already marked as complete" },
        { status: 400 },
      );
    }

    const nextDeliveryStatus = await resolveDeliveryStatusAfterUpdate(
      conn,
      order_id,
      order.dispatch_status,
    );

    const deliveredOnVal = delivered_on || new Date();
    await ensureOrderDeliveryBatchesTable(conn);

    const [batch1] = await conn.execute(
      `SELECT id FROM order_delivery_batches WHERE order_id = ? AND sequence_no = 1 LIMIT 1`,
      [order_id],
    );
    if (
      !batch1?.length &&
      (Number(order.delivery_status) === DELIVERY_STATUS_PARTIAL ||
        order.delivered_on ||
        order.delivery_proof)
    ) {
      await conn.execute(
        `INSERT INTO order_delivery_batches
          (order_id, sequence_no, delivered_on, delivery_proof, delivery_remark)
         VALUES (?, 1, ?, ?, ?)`,
        [
          order_id,
          order.delivered_on || null,
          order.delivery_proof || null,
          order.delivery_remark || null,
        ],
      );
    }

    await persistOrderDeliveryBatch(conn, order_id, {
      delivered_on: deliveredOnVal,
      delivery_proof: delivery_proof || null,
      delivery_remark: delivery_remark || null,
    });

    await conn.execute(
      "UPDATE neworder SET delivery_status = ?, delivered_on = ?, delivery_proof = ?, delivery_remark = ? WHERE order_id = ?",
      [
        nextDeliveryStatus,
        deliveredOnVal,
        delivery_proof || null,
        delivery_remark || null,
        order_id,
      ],
    );

    return NextResponse.json({
      success: true,
      message: "Delivery status updated successfully",
    });
  } catch (error) {
    console.error("Error updating delivery status:", error);
    return NextResponse.json(
      { error: "Failed to update delivery status" },
      { status: 500 },
    );
  }
}
