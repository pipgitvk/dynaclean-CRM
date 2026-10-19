import { NextResponse } from "next/server";
import { getDbConnection } from "@/lib/db";
import { getSessionPayload } from "@/lib/auth";
import { activateRemainDispatchBatch } from "@/lib/activateRemainDispatch";
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
    if (!orderId) {
      return NextResponse.json({ error: "order_id required" }, { status: 400 });
    }

    const conn = await getDbConnection();
    const result = await activateRemainDispatchBatch(conn, orderId);

    if (!result.activated) {
      return NextResponse.json(
        { success: false, error: result.reason || "Nothing to activate" },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      active_rows: result.active_rows,
    });
  } catch (e) {
    console.error("dispatch/activate-remain:", e);
    return NextResponse.json(
      { success: false, error: e?.message || "Failed to activate remain dispatch" },
      { status: 500 },
    );
  }
}
