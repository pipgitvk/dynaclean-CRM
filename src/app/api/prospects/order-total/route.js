import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getOrderProspectAmountContext } from "@/lib/getOrderProspectAmountContext";
import { canAccessProspectsRole } from "@/lib/prospectAccess";
import { userMayUseCustomerForProspect } from "@/lib/prospectCustomerAccess";
import { getDbConnection } from "@/lib/db";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload || !canAccessProspectsRole(payload.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orderId = String(searchParams.get("order_id") ?? "").trim();
    if (!orderId) {
      return NextResponse.json({
        success: true,
        context: null,
      });
    }

    let context = await getOrderProspectAmountContext(orderId);
    if (context?.customer_id) {
      const conn = await getDbConnection();
      const ok = await userMayUseCustomerForProspect(
        conn,
        context.customer_id,
        payload,
      );
      if (!ok) context = null;
    }
    return NextResponse.json({ success: true, context });
  } catch (e) {
    console.error("prospects order-total:", e);
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 },
    );
  }
}
