import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import NotificationService from "@/lib/services/NotificationService";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

export async function PATCH(req, { params }) {
  try {
    console.log("=== PATCH /api/notifications/[id] ===");
    const payload = await getSessionPayload();
    console.log("Payload:", payload);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    console.log("Notification ID:", id);

    const conn = await getDbConnection();
    const empId = await resolveGemCrmEmployeeId(conn, {
      username: payload.username,
      empId: payload.empId,
    });
    console.log("Resolved empId:", empId);

    if (!empId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    await NotificationService.markAsRead(parseInt(id), empId);
    console.log("Notification marked as read successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
