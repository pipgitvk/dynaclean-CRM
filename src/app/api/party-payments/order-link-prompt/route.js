import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { findPartyPaymentPromptForOrder } from "@/lib/partyPaymentOrderLink";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get("order_id");
    if (!orderId || !String(orderId).trim()) {
      return NextResponse.json({ error: "order_id is required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const partyPaymentPrompt = await findPartyPaymentPromptForOrder(
      conn,
      String(orderId).trim(),
    );

    return NextResponse.json({
      success: true,
      partyPaymentPrompt,
    });
  } catch (err) {
    console.error("[party-payments/order-link-prompt] GET:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: 500 },
    );
  }
}
