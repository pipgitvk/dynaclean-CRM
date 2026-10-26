import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import {
  applyPartyPaymentOrderLinkNo,
  applyPartyPaymentOrderLinkYes,
} from "@/lib/partyPaymentOrderLink";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const partyPaymentId = body.party_payment_id;
    const orderId = body.order_id;
    const decision = String(body.decision || "").trim().toLowerCase();

    if (!partyPaymentId || !orderId) {
      return NextResponse.json(
        { error: "party_payment_id and order_id are required" },
        { status: 400 },
      );
    }

    const conn = await getDbConnection();

    if (decision === "yes" || decision === "y") {
      const result = await applyPartyPaymentOrderLinkYes(
        conn,
        partyPaymentId,
        orderId,
        { createdBy: payload.username },
      );
      return NextResponse.json({ success: true, ...result });
    }

    if (decision === "no" || decision === "n") {
      const result = await applyPartyPaymentOrderLinkNo(conn, partyPaymentId);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      { error: "decision must be yes or no" },
      { status: 400 },
    );
  } catch (err) {
    console.error("[party-payments/order-link-decision] POST:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
