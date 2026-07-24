import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { manualSendPaymentDueNotifications } from "@/lib/cron/paymentDueNotificationCron";

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only allow ADMIN/SUPERADMIN to trigger manual tests
    if (!["SUPERADMIN", "ADMIN"].includes(payload.role)) {
      return NextResponse.json({ error: "Access denied - Admin only" }, { status: 403 });
    }

    console.log("🧪 Manual test triggered for payment due notifications");
    await manualSendPaymentDueNotifications();

    return NextResponse.json({ 
      success: true, 
      message: "Payment due notification check completed. Check server logs for details."
    });
  } catch (error) {
    console.error("Error triggering manual payment due notification test:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
