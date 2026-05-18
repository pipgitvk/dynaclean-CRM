import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import NotificationService from "@/lib/services/NotificationService";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

// Import and start the recurring task cron job
let cronStarted = false;
if (!cronStarted) {
  cronStarted = true;
  import("@/lib/cron/recurringTaskCron").then((mod) => {
    mod.startRecurringTaskCron();
  });
}

export async function GET(req) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const conn = await getDbConnection();
    const empId = await resolveGemCrmEmployeeId(conn, {
      username: payload.username,
      empId: payload.empId,
    });

    if (!empId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const notifications = await NotificationService.getUnreadNotifications(empId);
    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
