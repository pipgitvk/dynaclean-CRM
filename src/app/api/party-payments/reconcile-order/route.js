import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  applyPartyPaymentOrderLinkYes,
  syncPartyPaymentOutFromOrder,
} from "@/lib/partyPaymentOrderLink";

/** Re-apply capped order paid + party out/balance for an already-linked order. */
export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const orderId = body.order_id;
    if (!orderId) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const [rows] = await conn.execute(
      `SELECT id FROM party_payments WHERE linked_order_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId],
    );
    if (rows?.length) {
      const result = await applyPartyPaymentOrderLinkYes(
        conn,
        rows[0].id,
        orderId,
      );
      return NextResponse.json({ success: true, ...result });
    }

    const synced = await syncPartyPaymentOutFromOrder(conn, orderId);
    if (!synced || synced.skipped) {
      return NextResponse.json(
        { error: "No matching party payment pool for this order" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, ...synced });
  } catch (err) {
    console.error("[party-payments/reconcile-order] POST:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
