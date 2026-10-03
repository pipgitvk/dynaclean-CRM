import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import NotificationService, { ensureTableOnce } from "@/lib/services/NotificationService";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

// Startup block — एक बार चलता है, हर request पर नहीं
let cronStarted = false;
if (!cronStarted) {
  cronStarted = true;
  // Notification table एक बार बनाएं — table पहले से है तो no-op होगा
  ensureTableOnce();
  import("@/lib/cron/recurringTaskCron").then((mod) => {
    mod.startRecurringTaskCron();
  });
  import("@/lib/cron/paymentDueNotificationCron").then((mod) => {
    mod.startPaymentDueNotificationCron();
  });
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const empId = await resolveGemCrmEmployeeId({
      username: payload.username,
      empId: payload.empId,
    });

    if (!empId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const notifications = await NotificationService.getUnreadNotifications(empId);
    console.log(`📬 Fetched ${notifications.length} unread notifications for user ${empId}`);
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
