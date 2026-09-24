import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { canEditDeliveryProof } from "@/lib/orderDocumentEditRules";

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

    if (order.booking_by !== currentUsername) {
      return NextResponse.json(
        { error: "Only the booking person can update delivery status" },
        { status: 403 },
      );
    }

    if (Number(order.dispatch_status) !== 1) {
      return NextResponse.json(
        { error: "Delivery can only be updated after dispatch is done" },
        { status: 400 },
      );
    }

    const isDelivered = Number(order.delivery_status) === 1;

    if (isDelivered && update_proof_only) {
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

    if (isDelivered) {
      return NextResponse.json(
        { error: "Delivery is already marked as complete" },
        { status: 400 },
      );
    }

    await conn.execute(
      "UPDATE neworder SET delivery_status = 1, delivered_on = ?, delivery_proof = ?, delivery_remark = ? WHERE order_id = ?",
      [
        delivered_on || new Date(),
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
