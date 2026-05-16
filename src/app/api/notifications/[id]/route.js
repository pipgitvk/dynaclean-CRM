import { NextResponse } from "next/server";
import { getSessionPayload } from "@/lib/auth";
import { getDbConnection } from "@/lib/db";
import NotificationService from "@/lib/services/NotificationService";
import { resolveGemCrmEmployeeId } from "@/lib/gemCrmAuth";

export async function PATCH(req, { params }) {
  try {
    const payload = await getSessionPayload();
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const conn = await getDbConnection();
    const empId = await resolveGemCrmEmployeeId(conn, {
      username: payload.username,
      empId: payload.empId,
    });

    if (!empId) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    await NotificationService.markAsRead(parseInt(id), empId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
