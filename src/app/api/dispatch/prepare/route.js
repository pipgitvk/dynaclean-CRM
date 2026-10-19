import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { applyDispatchItemSelection } from "@/lib/dispatchPartialSelection";
import { canMutateDispatchRole } from "@/lib/roleKeyUtils";

export async function POST(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!canMutateDispatchRole(payload.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const orderId = body?.order_id;
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const result = await applyDispatchItemSelection(conn, orderId, items);

    return NextResponse.json({
      success: true,
      is_partial: result.isPartial,
      quote_number: result.quoteNumber,
    });
  } catch (e) {
    console.error("dispatch/prepare:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to prepare dispatch" },
      { status: 400 },
    );
  }
}
